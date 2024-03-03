import * as Rot from 'rot-js'

// An array of cells, where each cell is one of several different types:
// - floor (no other properties)
// - wall
// Walls represent un-mined pieces of the map and have other properties besides their type:
// - exposed: whether a neighbor of this cell is 'floor', meaning, the player can see it
// - ore: What kind of ore you would get for mining this

export default class Map {
  constructor(w, h) {
    this.w = w
    this.h = h

    // Draw some cessular caverns
    const cave = new Rot.Map.Cellular(w, h)
    cave.randomize(0.5)
    for (let i = 0; i < 6; i++) { cave.create() }

    // Connect it and copy it to an array of cell objects
    this.data = []
    cave.connect((x, y, empty) => {
      this.data[x + y * this.w] = { type: empty ? 'floor' : 'wall' }
    }, 1)

    // Hide the cells in interior walls
    this.calculateExposed()

    // Place ore veins
    for (let n = 0; n < 25; n++) {
      const [x, y] = this.randomCell(rockP)
      this.oreVein(x, y, 'copper', 10)
    }

    // Place the ladder up and down
    this.at(this.randomCell(c => floorP(c) && !this.neighbor(wallP))).type = 'ladder'
  }

  at([x, y]) {
    return this.data[x + y * this.w]
  }

  // Loop through each cell, invoking a callback(x, y, cell)
  eachCell(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        fn(x, y, this.data[x + y * this.w])
      }
    }
  }

  // Draw the map on to a Rot.Display
  draw(display) {
    this.eachCell((x, y, cell) => {
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
              case 'copper': display.draw(x, y, '%', '#fa0')
            }
          }
          break
        case 'ladder':
          display.draw(x, y, '=', '#dd0')
          break
      }
    })
  }

  calculateExposed() {
    this.eachCell((x, y, cell) => {
      if (cell.type === 'wall') {
        cell.exposed = this.neighbor(x, y, floorP)
      }
    })
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
      if (filter(this.data[x + y * this.w])) { return [x, y] }
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
}

// Some filters for common use
const floorP = c => c.type === 'floor'
const wallP = c => c.type === 'wall'
const rockP = c => c.type === 'wall' && !c.ore
