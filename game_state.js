import Map from './map'
import ECS from './ecs'
import { OnMap, Named, Display } from './components'
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

    this.tool = {
      dmg: 3, // Damage done to wall on bumping
      hardness: 1 // Max hardness of material that can be hit
    }

    this.logLines = []
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
    
    return false
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
    } else {
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
            this.ecs.add({ onMap: new OnMap(loc), named: new Named(name), display: new Display(name) })
            // Tell the map the terrain has changed
            this.map.update()
          }
        }
      }
    }
  }

  log(str) {
    this.logLines = ([str, ...this.logLines].slice(0, 6))
  }

  // A list of strings of what's on the player's cell
  // of the form "[n] thingName"
  onGround() {
    const playerLoc = this.ecs.get(this.playerId, 'onMap').pos
    const ids = this.idsAt(playerLoc)
    return ids.map((id, i) => {
      const str = this.ecs.get(id, 'named').inventory
      return `[${i + 1}] ${str}`
    })
  }
}
