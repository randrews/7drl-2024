import { OnMap, Named, Display, Carryable } from './components'

const Pickup = {
  key: 'p',
  description: '[P]ick up',
  needsItem: true,
  prompt: 'Pick up what? (or [q]uit)',
  canDo: (game) => {
    return game.anyAt(game.playerPos, ['carryable'])
  },
  verb: (game, id) => {
    game.log(`Picking up ${id}`)
    const carry = game.ecs.get(id, 'carryable')
    const onMap = game.ecs.get(id, 'onMap')
    if (!onMap) {
      game.debug('You are already carrying that')
      return
    }
    if (!carry) {
      game.log("You can't carry that")
      return
    }

    game.ecs.removeComponent(id, 'onMap') // Remove it from the map
    game.inventory.push(id) // Add it to the inventory
  }
}

const Drop = {
  key: 'd',
  description: '[D]rop',
  needsItem: true,
  prompt: 'Drop what? (or [q]uit)',
  canDo: (game) => {
    return game.inventory.length > 0
  },
  verb: (game, id) => {
    game.debug(`dropping ${id}`)
    if (game.ecs.get(id, 'onMap')) {
      game.log("You aren't carrying that")
      return
    }

    game.ecs.addComponent(id, 'onMap', new OnMap(game.playerPos)) // Add it to the map
    game.inventory = game.inventory.filter(o => o !== id) // Remove it from the inventory
  }
}

const Climb = {
  key: 'c',
  description: '[C]limb',
  canDo: (game) => {
    return game.anyAt(game.playerPos, ['climbable'])
  },
  verb: (game) => {
    game.debug("Climbing isn't implemented yet")
  }
}

export default [Pickup, Drop, Climb]