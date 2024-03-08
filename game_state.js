import Map from './map'
import ECS from './ecs'
import * as Rot from 'rot-js'
import { OnMap, Named, Display, Carryable, Inventory, Drinkable } from './components'
import { COLORS } from './balance'
import Actions from './actions'
import { makeMineral, makeMoss } from './types'

// If true, debug logs are enabled
const DEBUG = true

export class GameState {
  constructor() {
    this.map = new Map(80, 40)
    this.ecs = new ECS()

    const pos = this.map.validLadderPosition()

    // Add the player and the ladder to the world
    this.playerId = this.ecs.add({ onMap: new OnMap(pos), inventory: new Inventory(this.ecs) })
    this.ecs.add({ onMap: new OnMap(pos), named: new Named('ladder'), display: new Display('ladder'), climbable: true })

    // Throw some moss on the ground
    this.makeMoss(10)

    this.updateIndex()

    // Player stats stuff:
    this.tool = {
      dmg: 3, // Damage done to wall on bumping
      hardness: 1 // Max hardness of material that can be hit
    }

    // ui state:
    this.logLines = []
    this.selectMode = false
    this.pendingAction = null
    this.inputHandler = null
    
    // gameMode is either mine or workshop
    this.gameMode = 'mine'
  }

  draw(display) {
    // Draw map terrain
    this.drawMap(display)

    // Draw non-player objects on the map
    this.ecs.find(['onMap', 'display'], (_id, [onMap, disp]) => {
      const pos = [onMap.x, onMap.y]
      disp.draw(pos, display)
    })

    // Draw the player
    const [px, py] = this.playerPos
    display.draw(px, py, '@', '#fff', '#008')
  }

  // Draw the map on to a Rot.Display
  drawMap(display) {
    this.map.eachCell((x, y, cell) => {
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
            }
          }
          break
      }
    })
  }

  get playerPos() { return this.ecs.get(this.playerId, 'onMap').pos }
  get inventory() { return this.ecs.get(this.playerId, 'inventory') }

  // Show a helpful string for what we're hovering the mouse over
  hover(pos) {
    // First try the index:
    const ent = this.idsAt(pos)[0]
    if (ent) {
      return this.ecs.get(ent, 'named').hover
    } else {
      const cell = this.map.at(pos)
      switch (cell.type) {
      case 'wall':
        if (!cell.exposed) { return '' } // Hidden is hidden!
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
      const name = cell.ore ? `${cell.ore} ore` : 'rock'
      if (cell.hardness > this.tool.hardness) {
        this.log(`You need a better tool for ${name}`)
      } else {
        cell.hp -= this.tool.dmg
        if (cell.hp > 0) { this.log(`Mining ${name}`) }
        else {
          // Mined! Replace the map cell with a floor
          this.map.put(loc, { type: 'floor' })
          // Are we actually mining a quartz? If we roll a 10 we are!
          const quartz = name === 'rock' && Rot.RNG.getUniform() > 0.9
          // Create an entity for the thing
          if (quartz) {
            this.log('This rock contained a piece of quartz!')
            makeMineral(this.ecs, 'quartz')
          } else {
            this.log(`Mined ${name}`)
            makeMineral(this.ecs, name)
          }
            
          // Tell the map the terrain has changed
          this.map.update()
        }
      }
    }
  }

  makeMoss(count) {
    let mossLocs = {}
    while (Object.keys(mossLocs).length < count) {
      const ml = this.map.validMossPosition()
      const key = this.toKey(ml)
      if (!mossLocs[key]) {
        makeMoss(this.ecs, ml)
        mossLocs[key] = true
      }
    }
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

  // Returns a list of action names that can be taken right now
  actionStrings() {
    const a = []

    Actions.forEach((action) => {
      if (action.canDo(this)) { a.push(action.description) }
    })

    return a
  }
  
  enterWorkshop() {
    this.gameMode = 'workshop'
    // Empty inventory into ore buckets
  }
}

