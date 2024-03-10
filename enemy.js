import * as Rot from 'rot-js'
import { makeBody } from './types'

export class Enemy {
  constructor(type) {
    this.type = type

    if (type === 'elite') {
      this.dmg = 2
    } else {
      this.dmg = 1
    }

    this.active = false
    this.staggered = false
  }
}

export function tickEnemies(game) {
  const { ecs, map } = game

  ecs.find(['enemy', 'onMap'], (id, [enemy, onMap]) => {
    if (enemy.staggered) { // Were we just shoved? Skip a move
      enemy.staggered = false
      return
    }

    if (!enemy.active && game.map.isVisible(onMap.pos)) { // We were asleep, spend a round waking up
      game.log(`The ${enemy.type} is awoken by your footsteps`)
      enemy.active = true
    } else if (enemy.active) {
      // If we're next to the player, attack
      if (onMap.adjacent(game.playerPos)) {
        game.playerStats.hp -= enemy.dmg
        game.log(`The ${enemy.type} wounds you, -${enemy.dmg} HP`)
      } else {
        // Otherwise move toward the player
        const next = game.map.moveToward(onMap.pos, game.playerPos, (pos) => !game.anyAt(pos, ['enemy']))
        if (next) {
          onMap.pos = next
          game.updateIndex()
        }
      }
    }
  })
}

export function bumpEnemy(game, id) {
  const { ecs, map } = game

  ecs.forEach([id], ['onMap', 'enemy'], (id, [onMap, enemy]) => {
    const dir = [onMap.pos[0] - game.playerPos[0], onMap.pos[1] - game.playerPos[1]]
    const tgt = [onMap.pos[0] + dir[0], onMap.pos[1] + dir[1]]
    if (game.navigable(tgt)) {
      // If it's actually empty (incl no enemy) then move us there, else nothing happens:
      onMap.pos = tgt
      enemy.staggered = true
      game.log(`You shove the ${enemy.type}`)
    } else {
      // Uh oh, this is either a wall, enemy, or the edge of the map. Time to go squish:
      game.log(`You smash the ${enemy.type} against an obstacle`)
      ecs.remove(id)
      makeBody(ecs, onMap.pos)
      game.updateIndex()
    }
  })
}

export function stabEnemy(game, loc) {
  const { ecs, map } = game
  const ids = game.idsAt(loc)

  ecs.forEach(ids, ['onMap', 'enemy'], (id, [onMap, enemy]) => {
    if (enemy.type === 'elite') {
      game.log("Your attack glances off the elite's armor")
    } else {
      game.log(`You stab the ${enemy.type}, killing it`)
      ecs.remove(id)
      makeBody(ecs, onMap.pos)
      game.updateIndex()
    }
  })
}
