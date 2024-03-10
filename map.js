import * as Rot from 'rot-js'
import { HP, HARDNESS } from './balance'

// An array of cells, where each cell is one of several different types:
// - floor (no other properties)
// - wall
// Walls represent un-mined pieces of the map and have other properties besides their type:
// - exposed: whether a neighbor of this cell is 'floor', meaning, the player can see it
// - ore: What kind of ore you would get for mining this

export default class Map {
  constructor(w, h, level, gemsVisible) {
    this.w = w
    this.h = h
    this.level = level
    this.gemsVisible = gemsVisible

    // Draw some cellular caverns
    const cave = new Rot.Map.Cellular(w, h)
    cave.randomize(0.5)
    for (let i = 0; i < 6; i++) { cave.create() }

    // Connect it and copy it to an array of cell objects
    this.data = []
    cave.connect((x, y, empty) => {
      this.data[x + y * this.w] = { type: empty ? 'floor' : 'wall' }
    }, 1)

    this.emptyCallback = (x, y) => this.inBounds([x, y]) && floorP(this.at([x, y]))
    this.fov = new Rot.FOV.PreciseShadowcasting(this.emptyCallback)

    // Place ore veins
    let ores = { copper: 25, iron: 0, mithril: 0 }
    if (this.level === 2) {
      ores = { copper: 15, iron: 10, mithril: 0 }
    } else if (this.level === 3) {
      ores = { copper: 5, iron: 15, mithril: 5 }
    } else if (this.level > 3) {
      ores = { copper: 5, iron: 10, mithril: 10 }
    }

    Object.keys(ores).forEach((ore) => {
      for (let n = 0; n < ores[ore]; n++) {
        const [x, y] = this.randomCell(rockP)
        this.oreVein(x, y, ore, 10)
      }
    })

    if (this.level > 1) {
      for (let n = 0; n < 10; n++) {
        const [x, y] = this.validGemPosition()
        this.placeGem(x, y)
      }
    }

    // Hide the cells in interior walls
    this.calculateExposed()

    // Prime the FOV, we'll store a list of visible cells here
    this.visible = []

    // populate hp and hardness
    this.eachCell((_x, _y, cell) => {
        if (cell.type === 'wall') {
            cell.hp = HP[cell.ore || 'rock']
            cell.hardness = HARDNESS[cell.ore || 'rock']
        }
    })
  }

  get size() { return [this.w, this.h] }

  update() {
    this.calculateExposed()
  }

  at([x, y]) {
    return this.data[x + y * this.w]
  }

  inBounds([x, y]) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }

  put([x, y], val) {
    this.inBounds([x, y]) && (this.data[x + y * this.w] = val)
  }

  // Loop through each cell, invoking a callback(x, y, cell)
  eachCell(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        fn(x, y, this.data[x + y * this.w])
      }
    }
  }

  calculateExposed() {
    this.eachCell((x, y, cell) => {
      if (cell.type === 'wall') {
        cell.exposed = this.neighbor(x, y, floorP) || (this.gemsVisible && cell.ore === 'gem')
      }
    })
  }

  calculateVisible(playerLoc) {
    this.visible = []
    this.fov.compute(playerLoc[0], playerLoc[1], 100, (x, y) => (this.inBounds([x, y]) && this.visible.push(x + y * this.w)))
  }

  isVisible([x, y]) {
    return this.visible.indexOf(x + y * this.w) !== -1
  }

  moveToward(start, finish, emptyP) {
    let dir = null
    const passable = (x, y) => {
      if (x === start[0] && y === start[1]) { return true } // it always calls us with the start cell first...?
      if (!this.emptyCallback(x, y)) { return false } // If there's actually a wall, stop
      return emptyP([x, y]) // User supplied callback, usually "is there another mob here"
    }
    const path = new Rot.Path.AStar(finish[0], finish[1], passable, { topology: 4 })
    // This computes the _whole path_ even though we only want the first cell, so, ignore
    // oll but the first call to the callback. This would be a good change to the rot.js API
    path.compute(start[0], start[1], (x, y) => {
      if (dir) { return }
      if (x === start[0] && y === start[1] || x === finish[0] && y === finish[1]) { return }
      dir = [x, y]
    })
    return dir
  }

  // Returns whether the cell at the given coordinate has a neighbor that fits the filter
  neighbor(x, y, filter) {
    if (x > 0 && filter(this.data[(x - 1) + y * this.w])) { return true }
    if (y > 0 && filter(this.data[x + (y - 1) * this.w])) { return true }
    if (x < this.w - 1 && filter(this.data[(x + 1) + y * this.w])) { return true }
    if (y < this.h - 1 && filter(this.data[x + (y + 1) * this.w])) { return true }
    return false
  }

  // Gives a valid cell, that fits the filter, as [x, y], that's a random direction from the given point
  randomDir(x, y, filter) {
    const possible = []
    if (x > 0 && filter(this.data[(x - 1) + y * this.w])) { possible.push([x - 1, y]) }
    if (y > 0 && filter(this.data[x + (y - 1) * this.w])) { possible.push([x, y - 1]) }
    if (x < this.w - 1 && filter(this.data[(x + 1) + y * this.w])) { possible.push([x + 1, y]) }
    if (y < this.h - 1 && filter(this.data[x + (y + 1) * this.w])) { possible.push([x, y + 1]) }
    if (possible.length === 0) { return null }
    return Rot.RNG.getItem(possible)
  }

  // Gives a valid cell, that fits the given filter, as [x, y]
  randomCell(filter) {
    while (true) {
      const x = Math.floor(Rot.RNG.getUniform() * this.w)
      const y = Math.floor(Rot.RNG.getUniform() * this.h)
      if (filter(this.data[x + y * this.w], [x, y])) { return [x, y] }
    }
  }

  // Creates an ore vein of max length len, of the given type of ore, starting at x, y.
  // This is just a random walk through wall tiles until we hit one that's not ore=null
  // or until we are len long
  oreVein(x, y, type, len) {
    let curr = [x, y]
    const paint = () => {
      const cell = this.data[curr[0] + curr[1] * this.w]
      if (cell.ore) {
        return false // can't paint, already an ore
      } else {
        cell.ore = type
        return true
      }
    }

    let count = 1
    while (curr && paint() && count++ < len) {
      curr = this.randomDir(curr[0], curr[1], rockP)
    }
  }
  
  placeGem(x, y) {
    const cell = this.at([x, y])
    cell.ore = 'gem'
  }
  
  validLadderPosition() {
    return this.randomCell((c, l) => (floorP(c) && !this.neighbor(l[0], l[1], wallP)))
  }

  validMossPosition() {
    return this.randomCell(floorP)
  }
  
  validGemPosition() {
    return this.randomCell((c, l) => (rockP(c) && !this.neighbor(l[0], l[1], floorP)))
  }
}

// Some filters for common use
const floorP = c => c.type === 'floor'
const wallP = c => c.type === 'wall'
const rockP = c => c.type === 'wall' && !c.ore
