import Map from './map'
import ECS from './ecs'
import * as Rot from 'rot-js'
import { OnMap, Named, Display, Carryable, Wallet, Player } from './components'
import { Inventory } from './inventory'
import { tickEnemies } from './enemy'
import { COLORS, DEBUG } from './balance'
import Actions from './actions'
import { makeMineral, makeMoss, makeEnemy } from './types'
import * as Workshop from './workshop'

export class GameState {
  constructor() {
    this.map = new Map(80, 40, 1, false)
    this.ecs = new ECS()

    // Add the player and the ladder to the world
    this.playerId = this.ecs.add({ inventory: new Inventory(this.ecs), wallet: new Wallet(0), player: new Player() })

    this.setupMap(this.map)
    this.updateIndex()

    // Create the workshop
    this.workshopId = this.makeWorkshop()

    // ui state:
    this.logLines = []
    this.selectMode = false
    this.pendingAction = null
    this.inputHandler = null
    
    // gameMode is either mine or workshop
    this.gameMode = 'mine'
  }

  setupMap(map) {
    // Where we'll put the ladder and player
    const pos = map.validLadderPosition()
    this.ecs.add({ onMap: new OnMap(pos), named: new Named('ladder'), display: new Display('ladder'), climbable: true })
    this.ecs.addComponent(this.playerId, 'onMap', new OnMap(pos))

    // Throw some moss on the ground
    this.makeMoss(map, 10)

    // Add mobs
    this.makeMobs(map, pos)

    map.calculateVisible(pos)
  }

  draw(display) {
    // Draw map terrain
    this.drawMap(display)

    // Draw non-player objects on the map
    this.ecs.find(['onMap', 'display'], (_id, [onMap, disp]) => {
      const pos = [onMap.x, onMap.y]
      disp.draw(pos, display, this)
    })

    // Draw the player
    const [px, py] = this.playerPos
    display.draw(px, py, '@', '#fff', '#008')
  }

  // Draw the map on to a Rot.Display
  drawMap(display) {
    this.map.eachCell((x, y, cell) => {
      if (this.map.isVisible([x, y])) {
        switch (cell.type) {
          case 'floor':
            display.draw(x, y, ' ')
            break
          case 'wall':
            if (!cell.exposed) {
              display.draw(x, y, '#', '#555')
            } else if (!cell.ore) {
              display.draw(x, y, '#', '#ddd')
            } else {
              switch (cell.ore) {
                case 'copper': display.draw(x, y, '#', COLORS.copper); break
                case 'iron': display.draw(x, y, '#', COLORS.iron); break
                case 'mithril': display.draw(x, y, '#', COLORS.mithril); break
                case 'gem': display.draw(x, y, '*', COLORS.gem); break
              }
            }
            break
        }
      } else {
        display.draw(x, y, '+', '#000', '#555')
      }
    })
  }

  get playerPos() { return this.ecs.get(this.playerId, 'onMap').pos }
  get inventory() { return this.ecs.get(this.playerId, 'inventory') }
  get stockpile() { return this.ecs.get(this.workshopId, 'inventory') }
  get wallet() { return this.ecs.get(this.playerId, 'wallet') }
  get playerStats() { return this.ecs.get(this.playerId, 'player') }
  get rooms() { return this.ecs.get(this.workshopId, 'rooms') }

  // Show a helpful string for what we're hovering the mouse over
  hover(pos) {
    const visible = this.map.isVisible(pos)

    // First try the index:
    const ent = this.idsAt(pos)[0]
    if (ent) {
      const comp = this.ecs.get(ent, 'named')
      if (visible || comp.type === 'ladder' || comp.type === 'gem' && playerStats.hasSensor) {
        return comp.hover
      }
    } else {
      const cell = this.map.at(pos)
      if (!cell) { return } // Layout / font size issue on Linux
      switch (cell.type) {
        case 'wall':
          if (!cell.exposed || !visible) { return '' } // Hidden is hidden!
          else if (cell.ore === 'gem') { return 'gem' } // Show ore types
          else if (cell.ore) { return `${cell.ore} ore` } // Show ore types
          else { return 'rock' } // plain old rock
          break
      }
    }
  }

  // Dealing eith the index
  updateIndex() { this.index = this.ecs.index(['onMap', 'named'], om => this.toKey(om.pos)) } // Build the index of onMap entities
  idsAt(pos) { return this.index(this.toKey(pos)) } // All entities at a map location [x, y]
  toKey([x, y]) { return x + y * this.map.w } // Turn a position into an index key

  // Handle a keycode and return whether it's one we care about
  keyPressed(key) {
    if (this.inputHandler) {
      // An inputHandler is something with an action that can request input.
      // We'll pass keys to it until it removes itself. But we'll always have
      // 'q' to quit that mode
      if (key === 'q') {
        this.inputHandler = null
        this.log('Never mind')
        return true
      } else { return this.inputHandler(this, key) }
   } else {
      switch (key) {
      case 'ArrowDown':
        this.movePlayer([0, 1])
        return true
        break
      case 'ArrowUp':
        this.movePlayer([0, -1])
        return true
        break
      case 'ArrowLeft':
        this.movePlayer([-1, 0])
        return true
        break
      case 'ArrowRight':
        this.movePlayer([1, 0])
        return true
        break
      }

      Actions.forEach((action) => {
        if (key === action.key && action.canDo(this)) {
          action.verb(this)
          return true
        }
      })

      return false
    }
  }

  movePlayer([dx, dy]) {
    let [x, y] = this.playerPos
    const [mx, my] = this.map.size
    x += dx; y += dy
    if (x >= 0 && x < mx && y >= 0 && y < my) {
      if (this.navigable([x, y])) {
        this.ecs.get(this.playerId, 'onMap').pos = [x, y]
      } else {
        this.bumpAll([x, y])
      }
      this.tick()
      this.updateIndex()
    }
  }

  navigable(loc) {
    return this.map.at(loc).type === 'floor'
  }

  bumpAll(loc) {
    if (this.map.at(loc).type === 'floor') {
      const ids = this.idsAt(loc)
      ids.forEach((id) => {
        const fn = this.ecs.get(id, 'bumpable')
        fn && fn(id)
      })
    } else { // The map only contains walls and floors, so...
      this.mine(loc)
    }
  }

  mine(loc) {
    const cell = this.map.at(loc)
    if (cell.type === 'wall') {
      const name = cell.ore === 'gem' ? 'gem' : cell.ore ? `${cell.ore} ore` : 'rock'
      if (cell.hardness > this.playerStats.hardness) {
        if (name === 'gem') {
          this.log(`You need a better tool for gems`)
        } else {
          this.log(`You need a better tool for ${name}`)
        }
      } else {
        cell.hp -= this.playerStats.dmg
        if (cell.hp > 0) { this.log(`Mining ${name}`) }
        else {
          // Mined! Replace the map cell with a floor
          this.map.put(loc, { type: 'floor' })
          // Are we actually mining a quartz? If we roll a 10 we are!
          const quartz = name === 'rock' && Rot.RNG.getUniform() > 0.9
          // Create an entity for the thing
          if (quartz) {
            this.log('This rock contained a piece of quartz!')
            makeMineral(this.ecs, 'quartz', loc)
          } else {
            this.log(`Mined ${name}`)
            makeMineral(this.ecs, name, loc)
          }
            
          // Tell the map the terrain has changed
          this.map.update()
        }
      }
    }
  }

  makeMoss(map, count) {
    let mossLocs = {}
    while (Object.keys(mossLocs).length < count) {
      const ml = map.validMossPosition()
      const key = this.toKey(ml)
      if (!mossLocs[key]) {
        makeMoss(this.ecs, ml)
        mossLocs[key] = true
      }
    }
  }

  makeMobs(map, playerPos) {
    const pKey = this.toKey(playerPos)
    const eliteCount = map.level
    let elitesPlaced = 0
    const mobCount = map.level * 3
    let mobLocs = {}
    while (Object.keys(mobLocs).length < eliteCount + mobCount) {
      const ml = map.validMossPosition() // Both of these can go anywhere on empty floor
      const key = this.toKey(ml)      
      if (!mobLocs[key] && pKey !== key) { // Prevent it from spawning a mob underneath us
        makeEnemy(this.ecs, ml, elitesPlaced < eliteCount ? 'elite' : 'enemy')
        elitesPlaced++
        mobLocs[key] = true
      }
    }
  }

  makeWorkshop() {
    const inv = new Inventory(this.ecs)
    inv.stackLimit = 1000
    inv.inventoryLimit = 1000
    const rooms = {}
    if (DEBUG) {
      rooms.gym = true
      rooms.forge = true
      rooms.garden = true
      rooms.workbench = true
    }
    return this.ecs.add({ inventory: inv, rooms })
  }

  log(str) {
    this.logLines = ([str, ...this.logLines].slice(0, 6))
  }
  debug(str) {
    if (DEBUG) {
      this.logLines = ([str, ...this.logLines].slice(0, 6))
    }
  }

  // Return whether any entities at the location have a certain set of components
  anyAt(loc, query) {
    let any = false
    this.ecs.forEach(this.idsAt(loc), query, () => (any = true))
    return any
  }

  // key is a string of a single character, ideally 1-9 or a-z
  // Find which entity id (if any) is in the inventory or on the ground for that key
  entityForKey(key) {
    const alphabet = 'abcdefghijklmnoprstuvwxyz'
    if (alphabet.indexOf(key) !== -1) {
      // It's a letter so we'll look in the inventory
      return this.inventory.inventoryItemAt(alphabet.indexOf(key))
    }
    
    const digits = '1234567890'
    if (digits.indexOf(key) !== -1) {
      // Digit so we look on the ground
      return this.idsAt(this.playerPos)[digits.indexOf(key)]
    }
    
    // What even is this
    return null
  }

  // A list of strings of what's on the player's cell
  onGround() {
    let i = 1
    return this.ecs.map(this.idsAt(this.playerPos), ['named'], (id, [named]) => {
      const str = this.ecs.get(id, 'named').inventory
      if (this.selectMode) {
        // If we're selecting something, show digits to select
        return `[${i++}] ${str}`
      } else {
        return str
      }
    })
  }

  // A list of strings of what's in the inventory
  inventoryStrings() {
    const alphabet = 'abcdefghijklmnoprstuvwxyz'
    let strs = this.inventory.inventoryStrings()

    // If we're selecting something, show letters to select
    if (this.selectMode) {
      strs = strs.map((s, i) => `[${alphabet.charAt(i)}] ${s}`)
    }

    while (strs.length < this.inventory.inventoryLimit) { strs.push('---') }
    return strs
  }

  // A list of strings of what's in the inventory
  stockpileStrings() { return this.stockpile.inventoryStrings() }

  // Returns a list of action names that can be taken right now
  actionStrings() {
    const a = []

    Actions.forEach((action) => {
      if (action.canDo(this)) { a.push(action.description) }
    })

    return a
  }

  playerStrings() {
    const strs = []
    strs.push(`HP: ${this.playerStats.hpDescription}`)
    strs.push(`Money: $${this.wallet.amount}`)
    strs.push(`Stack limit: ${this.inventory.stackLimit}`)
    strs.push(`Tool: ${this.playerStats.tool}`)
    strs.push(`Gear: ${this.playerStats.gearDescription}`)
    return strs
  }

  enterWorkshop() {
    this.gameMode = 'workshop'

    // Empty inventory into ore buckets
    const toDump = []
    this.inventory.forEach(id => (this.ecs.get(id, 'stockable') && toDump.push(id)))
    toDump.forEach((id) => {
      this.inventory.dropItem(id)
      this.stockpile.giveItem(id)
    })
    
    this.playerStats.hp = this.playerStats.maxHp
  }
  
  climbDown() {
    // generate a new map: higher level, same gemsVisible
    const nextLevel = new Map(this.map.w, this.map.h, this.map.level + 1, this.map.gemsVisible)

    // Remove the player from the old map (so we don't delete him)
    this.ecs.removeComponent(this.playerId, 'onMap')

    // Remove anything on the old map
    const ids = []
    this.ecs.find(['onMap'], id => ids.push(id))
    ids.forEach(id => this.ecs.remove(id))

    // Setup props on the new map (also placing the ladder and player there)
    this.setupMap(nextLevel)

    // Finally...
    this.map = nextLevel

    // We've just changed a lot of things
    this.updateIndex()
  }

  tick() {
    this.updateIndex()
    this.map.calculateVisible(this.playerPos)
    tickEnemies(this)
    this.checkGameEnd()
  }

  checkGameEnd() {
    if (this.playerStats.hp <= 0) { this.gameMode = 'defeat' }
  }
  
  workshopOptions() { return Workshop.workshopOptions(this.ecs, this.workshopId, this.playerId) }
  workshopAction(action) { return Workshop.actions[action](this) }
}

