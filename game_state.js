import Map from './map'
import ECS from './ecs'
import { OnMap, Named, Display, Carryable } from './components'
import { COLORS } from './balance'

export class GameState {
  constructor() {
    this.map = new Map(80, 40)
    this.ecs = new ECS()

    const pos = this.map.validLadderPosition()

    // Add the player and the ladder to the world
    this.playerId = this.ecs.add({ onMap: new OnMap(pos)})
    this.ecs.add({ onMap: new OnMap(pos), named: new Named('ladder'), display: new Display('ladder') })

    this.updateIndex()

    // Player stats stuff:
    this.tool = {
      dmg: 3, // Damage done to wall on bumping
      hardness: 1 // Max hardness of material that can be hit
    }
    this.inventory = []

    // ui state:
    this.logLines = []
    this.selectMode = false
    this.pendingAction = null
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

  get playerPos() {
    return this.ecs.get(this.playerId, 'onMap').pos
  }

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

  // Build the index of onMap entities
  updateIndex() {
    this.index = this.ecs.index(['onMap', 'named'], om => this.toKey(om.pos))
  }

  idsAt(pos) {
    return this.index(this.toKey(pos))
  }

  // Turn a position into an index key
  toKey([x, y]) {
    return x + y * this.map.w
  }

  // Handle a keycode and return whether it's one we care about
  keyPressed(key) {
    if (this.selectMode) {
      // Canceling selecting an item
      if (key === 'q') {
        this.selectMode = false
        this.log('Never mind')
        return true
      }

      const id = this.entityForKey(key)
      
      if (!id) {
        this.log("I don't know what that is ([q]uit?)")
        return false // bubble the key because maybe it's f12 or something
      }

      this.selectMode = false

      switch (this.pendingAction) {
      case 'pickup':
        this.pickup(id)
        return true
        break
      case 'drop':
        this.drop(id)
        return true
        break
      }
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

      case 'p':
        if (this.canPickup()) {
          this.log('Pick up what? (or [q]uit)')
          this.selectMode = true
          this.pendingAction = 'pickup'
          return true
        } else {
          return false
        }
        break

      case 'd':
        if (this.canDrop()) {
          this.log('Drop what? (or [q]uit)')
          this.selectMode = true
          this.pendingAction = 'drop'
          return true
        } else {
          return false
        }
        break
      }
    
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
    if (this.map.at(loc).type === 'floor') {
      // It's a floor but does it contain a solid object?
      const ids = this.idsAt(loc)
      return ids.map(id => this.ecs.get(id, 'onMap')).every(c => !c.solid)
    } else {
      return false
    }
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
          this.log(`Mined ${name}`)
          // Mined! Replace the map cell with a floor
          this.map.put(loc, { type: 'floor' })
          // Create an entity for the ore
          this.ecs.add({ onMap: new OnMap(loc), named: new Named(name), display: new Display(name), carryable: new Carryable(name) })
          // Tell the map the terrain has changed
          this.map.update()
        }
      }
    }
  }

  log(str) {
    this.logLines = ([str, ...this.logLines].slice(0, 6))
  }

  anyAt(loc, query) {
    let any = false
    this.ecs.forEach(this.idsAt(loc), query, () => (any = true))
    return any
  }

  // key is a string of a single character, ideally 1-9 or a-z
  entityForKey(key) {
    const alphabet = 'abcdefghijklmnoprstuvwxyz'
    if (alphabet.indexOf(key) !== -1) {
      // It's a letter so we'll look in the inventory
      return this.inventory[alphabet.indexOf(key)]
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
  // of the form "[n] thingName"
  onGround() {
    let i = 1
    return this.ecs.map(this.idsAt(this.playerPos), ['named'], (id, [named]) => {
      const str = this.ecs.get(id, 'named').inventory
      if (this.selectMode) {
        return `[${i++}] ${str}`
      } else {
        return str
      }
    })
  }

  canPickup() {
    return this.anyAt(this.playerPos, ['carryable'])
  }

  canDrop() {
    return this.inventory.length > 0
  }

  pickup(id) {
    const carry = this.ecs.get(id, 'carryable')
    const onMap = this.ecs.get(id, 'onMap')
    if (!onMap) {
      this.log('You are already carrying that')
      return
    }
    if (!carry) {
      this.log("You can't carry that")
      return
    }

    this.ecs.removeComponent(id, 'onMap') // Remove it from the map
    this.inventory.push(id) // Add it to the inventory
    this.updateIndex() // Update what's where on the map
  }

  drop(id) {
    if (this.ecs.get(id, 'onMap')) {
      this.log("You aren't carrying that")
      return
    }

    this.ecs.addComponent(id, 'onMap', new OnMap(this.playerPos)) // Add it to the map
    this.inventory = this.inventory.filter(o => o !== id) // Remove it from the inventory
    this.updateIndex() // Update what's where on the map
  }

  // Returns a list of action names that can be taken right now
  actions() {
    const a = []

    if (this.canPickup()) { a.push('[P]ick up') }
    if (this.canDrop()) { a.push('[D]rop') }

    return a
  }

  inventoryStrings() {
    const alphabet = 'abcdefghijklmnoprstuvwxyz'
    let i = 0
    return this.ecs.map(this.inventory, ['named'], (_, [n]) => {
      if (this.selectMode) {
        return `[${alphabet.charAt(i++)}] ${n.inventory}`
      } else {
        return n.inventory
      }
    })
  }
}
