import { COLORS } from './balance'

// A component for something that's on the map: it has a location and
// some flags for how it interacts with movement and LOS
export class OnMap {
  constructor(pos, flags) {
    this.pos = pos
    this.flags = flags || {}
  }
    
  get x() { return this.pos[0] }
  get y() { return this.pos[1] }
  
  // Solid objects cannot be moved through
  get solid() { return !!this.flags.solid }
  
  // Opaque objects cannot be seen through
  get opaque() { return !!this.flags.opaque }
}

export class Named {
  constructor(type) {
    this.type = type
  }

  get name() {
    return type
  }

  
  get hover() {
    switch (this.type) {
    case 'ladder':
      return 'ladder (up or down)'
      break
    case 'rock':
      return 'loose rock'
      break
    case 'copper ore':
      return 'ore (copper)'
      break
    default:
      return this.type
    }
  }
  
  get inventory() {
    return this.hover
  }
}

export class Display {
  constructor(type) {
    this.type = type
  }

  draw([x, y], display) {
    switch (this.type) {
    case 'ladder':
      display.draw(x, y, '=', '#dd0')
      break
    case 'copper ore':
      display.draw(x, y, 'o', COLORS.copper)
      break
    case 'rock':
      display.draw(x, y, 'o', COLORS.rock)
      break
    }
  }
}