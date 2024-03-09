import { OnMap, Named, Display, Carryable } from './components'

// An inputHandler for a GameState that will select an item
// from either the inventory or the ground
function selectItemHandler(game, key) {
  const id = game.entityForKey(key) // Find what we just selected

  if (!id) { // We selected nonsense...?
    game.log("I don't know what that is ([q]uit?)")
    return false // bubble the key because maybe it's f12 or something
  }

  game.pendingAction.finish(game, id) // Actually do the action
  game.selectMode = false // Clear the UI states
  game.pendingAction = null
  game.inputHandler = null
  game.updateIndex() // Update what's where on the map
  return true
}

const Pickup = {
  key: 'p',
  description: '[P]ick up',
  canDo: (game) => {
    return game.anyAt(game.playerPos, ['carryable'])
  },
  verb: (game) => {
    if (game.onGround().length > 1) {
      game.log('Pick up what? (or [q]uit)')
      game.selectMode = true
      game.pendingAction = Pickup
      game.inputHandler = selectItemHandler
    } else {
      const ids = game.idsAt(game.playerPos)
      game.ecs.forEach(ids, ['carryable'], id => Pickup.finish(game, id))
    }
  },
  finish: (game, id) => {
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

    // Try to pick up...
    if (game.inventory.giveItem(id)) {
      game.ecs.removeComponent(id, 'onMap') // Succeed? remove it from the map
      game.updateIndex()
    } else {
      game.log('No room!') // Fail? say so
    }
    game.tick()
  }
}

const Drop = {
  key: 'd',
  description: '[D]rop',
  canDo: (game) => {
    return !game.inventory.empty()
  },
  verb: (game) => {
    game.log('Drop what? (or [q]uit)')
    game.selectMode = true
    game.pendingAction = Drop
    game.inputHandler = selectItemHandler
  },
  finish: (game, id) => {
    game.debug(`dropping ${id}`)
    if (game.ecs.get(id, 'onMap')) {
      game.log("You aren't carrying that")
      return
    }

    game.inventory.dropItem(id, game.playerPos)
    game.tick()
  }
}

const Climb = {
  key: 'c',
  description: '[C]limb',
  canDo: (game) => {
    return game.anyAt(game.playerPos, ['climbable'])
  },
  verb: (game) => {
    game.inputHandler = Climb.finish
    game.log('Climb [U]p or [D]own? (or [q]uit)')
  },
  finish: (game, key) => {
    switch (key) {
    case 'u':
      game.log('Climbing back up to workshop')
      game.inputHandler = null
      game.enterWorkshop()
      return true
    case 'd':
      const level = game.map.level
      game.log(`Climbing to level ${level + 1}`)
      game.climbDown()
      game.inputHandler = null
      return true
    default:
      game.log('Which direction? (or [q]uit)')
      return false
    }
  }
}

const Quaff = {
  key: 'q',
  description: '[Q]uaff',
  canDo: (game) => game.inventory.hasAny('potion'),
  verb: (game) => {
    if (game.playerStats.hp < game.playerStats.maxHp) {
      game.playerStats.hp = game.playerStats.maxHp
      const id = game.inventory.removeType('potion')
      game.ecs.remove(id)
      game.log('Your wounds are healed!')
    } else {
      game.log("You don't need a potion right now")
    }
  },
}

export default [Pickup, Drop, Climb, Quaff]