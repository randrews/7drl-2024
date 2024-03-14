import { COLORS } from './balance'

// A component for something that's on the map: it has a location and
// some flags for how it interacts with movement and LOS
export class OnMap {
  constructor(pos) {
    this.pos = pos
  }
    
  get x() { return this.pos[0] }
  get y() { return this.pos[1] }

  adjacent(other) {
    const dx = Math.abs(this.pos[0] - other[0])
    const dy = Math.abs(this.pos[1] - other[1])
    return dx + dy === 1 // 'on top of' is not 'adjacent'
  }
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

  draw([x, y], display, game) {
    const visible = game.map.isVisible([x, y])
    const sensor = game.playerStats.hasSensor

    switch (this.type) {
      case 'ladder':
        display.draw(x, y, '=', '#000', '#dd0')
        break
      case 'copper ore':
        visible && display.draw(x, y, 'o', COLORS.copper)
        break
      case 'iron ore':
        visible && display.draw(x, y, 'o', COLORS.iron)
        break
      case 'mithril ore':
        visible && display.draw(x, y, 'o', COLORS.mithril)
        break
      case 'gem':
        (visible || sensor) && display.draw(x, y, '*', COLORS.gem)
        break
      case 'rock':
        visible && display.draw(x, y, 'o', COLORS.rock)
        break
      case 'quartz':
        visible && display.draw(x, y, '*', COLORS.quartz)
        break
      case 'moss':
        visible && display.draw(x, y, '%', '#0d3')
        break
      case 'potion':
        visible && display.draw(x, y, 'i', '#d33')
        break
      case 'enemy':
        visible && display.draw(x, y, '&', '#ee0')
        break
      case 'elite':
        visible && display.draw(x, y, '&', '#000', '#ee0')
        break
      case 'body':
        visible && display.draw(x, y, 'x', '#600')
        break
    }
  }
}

export class Carryable {
  constructor(type) { this.type = type }
}

export class Sellable {
  constructor(price) { this.price = price }
}

export class Wallet {
  constructor(amount) { this.amount = amount }
  transact(delta) { this.amount += delta }
}

export class Player {
  constructor() {
    this.hp = 10
    this.maxHp = 10
    this.tool = 'bronze pickaxe'
    this.dmg = 3 // Damage done to wall on bumping
    this.hardness = 1 // Max hardness of material that can be hit
    this.gear = []
  }

  get hpDescription() {
    return `${this.hp} / ${this.maxHp}`
  }

  get gearDescription() {
    if (this.gear.length === 0) { return '-none-' }
    return this.gear.join(', ')
  }

  get hasSensor() {
    return this.gear.indexOf('gem sensor') !== -1
  }
}
