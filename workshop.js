export class Link {
  constructor(room, text, action, active) {
    this.room = room
    this.text = text
    this.action = action
    this.active = active
  }

  get enabled() { return this.active }
  get disabled() { return !this.active }
}

// Return a list of Links of the things we want to show in the
// market
export function workshopOptions(ecs, workshopId, playerId) {
  const stockpile = ecs.get(workshopId, 'inventory')
  const links = [
    new Link('mine', 'Return to mine', 'return-to-mine', true)
  ]

  if (stockpile.hasAny('quartz')) { links.push(new Link('market', 'Sell quartz (+$1)', 'sell quartz', true)) }

  return links
}

export const actions = {}

actions['return-to-mine'] = (game) => {
  game.log('You yearn for the mines!')
  game.gameMode = 'mine'
}

actions['sell quartz'] = (game) => {
  if (game.stockpile.removeType('quartz')) {
    game.log('selling a quartz')
    game.wallet.transact(1)
  }
}