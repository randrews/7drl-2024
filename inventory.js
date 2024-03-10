import { OnMap } from './components'

export class Inventory {
  constructor(ecs) {
    this.ecs = ecs
    this.stackLimit = 5
    this.inventoryLimit = 3

    // Not just a list of ids, a list of arrays of ids of the same carryable type
    this.inventory = []
  }

  // Loop through all carried IDs
  forEach(fn) {
    this.inventory.forEach(stack => stack.forEach(id => fn(id)))
  }

  empty() { return this.inventory.length === 0 }

  // Return whether the inventory has any stacks of a given `carryable` type
  hasAny(type) {
    return this.inventory.reduce((any, stack) => (any || this.getType(stack[0]) === type), false)
  }

  // Try to remove a carryable of the given type, return the id or null
  removeType(type) {
    const stack = this.inventory.find(s => this.getType(s[0]) === type)
    if (!stack) { return null }
    const id = stack.pop()
    this.inventory = this.inventory.filter(s => s.length > 0)
    return id
  }

  removeCount(type, count) {
    if (!count) { throw `not a count: ${count}`}
    const ids = []
    this.inventory.forEach((stack) => {
      while (count > 0 && stack[0] && this.getType(stack[0]) === type) {
        ids.push(stack.shift())
        count--
      }
    })
    this.inventory = this.inventory.filter(s => s.length > 0)
    return ids
  }

  countType(type) {
    return this.inventory.reduce((total, stack) => {
      if (this.getType(stack[0]) === type) { return total + stack.length }
      else { return total }
    }, 0)
  }

  // util method, get the carryable type of an id
  getType(id) { return this.ecs.get(id, 'carryable').type }

  // Try to add the given id to the inventory, respecting limits, and return whether
  // we could or not
  giveItem(id) {
    const toBeAdded = this.getType(id)

    // First try and find a stack of the same stuff:
    const stack = this.inventory.find(stack => this.getType(stack[0]) === toBeAdded && stack.length < this.stackLimit)

    if (stack) { // Add id to a stack
      stack.push(id)
      return true
    } else { // Create a new stack
      if (this.inventory.length < this.inventoryLimit) {
        this.inventory.push([id])
        return true
      } else { return false }
    }
  }

  // Drop the stack containing the given id, if we contain it
  // loc is optional; if omitted then the id is just removed from
  // inventory, not placed on the map
  dropItem(id, loc) {
    const stack = this.inventory.find(s => s.indexOf(id) !== -1)

    if (stack) {
      if (loc) {
        stack.forEach(item => this.ecs.addComponent(item, 'onMap', new OnMap(loc)))
      }
      const idx = this.inventory.indexOf(stack)
      this.inventory.splice(idx, 1)
    }
  }

  // Return one of the (identical) items stacked at index i, or null
  inventoryItemAt(i) {
    return this.inventory[i] && this.inventory[i][0]
  }

  inventoryStrings() {
    return this.inventory.map((stack) => {
      const name = this.getType(stack[0])
      return stack.length === 1 ? name : `${name} (${stack.length})`
    })
  }
}
