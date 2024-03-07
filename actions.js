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
    game.debug(`Picking up ${id}`)
    const carry = game.ecs.get(id, 'carryable')
    const onMap = game.ecs.get(id, 'onMap')
    if (!onMap) {
      game.log('You are already carrying that')
      return
    }
    if (!carry) {
      game.log("You can't carry that")
      return
    }

    game.inventory.giveItem(id) ? // Try to pick up...
      game.ecs.removeComponent(id, 'onMap') : // Succeed? remove it from the map
      game.log('No room!') // Fail? say so
  }
}

const Drop = {
  key: 'd',
  description: '[D]rop',
  needsItem: true,
  prompt: 'Drop what? (or [q]uit)',
  canDo: (game) => {
    return !game.inventory.empty()
  },
  verb: (game, id) => {
    game.debug(`dropping ${id}`)
    if (game.ecs.get(id, 'onMap')) {
      game.log("You aren't carrying that")
      return
    }

    game.inventory.dropItem(id, game.playerPos)
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