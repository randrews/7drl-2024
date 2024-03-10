export class Enemy {
  constructor(type) {
    this.type = type

    if (type === 'elite') {
      this.hp = 5
      this.dmg = 2
    } else {
      this.hp = 2
      this.dmg = 1
    }

    this.active = false
  }
}

export function tickEnemies(game) {
  const { ecs, map } = game

  ecs.find(['enemy', 'onMap'], (id, [enemy, onMap]) => {
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
