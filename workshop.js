import { VALUES } from './balance'
import { makeIngot } from './types'

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
  const rooms = ecs.get(workshopId, 'rooms')
  const money = ecs.get(playerId, 'wallet').amount
  const rocks = stockpile.countType('rock')
  const moss = stockpile.countType('moss')
  const cu = stockpile.countType('copper ore')
  const fe = stockpile.countType('iron ore')
  const mi = stockpile.countType('mithril ore')
  const inventory = ecs.get(playerId, 'inventory')
  const maxHp = ecs.get(playerId, 'player').maxHp

  const links = [
    new Link('mine', 'Return to mine', 'return-to-mine', true)
  ]

  // Selling things for money
  if (stockpile.hasAny('quartz')) { links.push(new Link('market', `Sell quartz (+$${VALUES.quartz})`, 'sell quartz', true)) }

  // The workbench room
  if (rooms.workbench) {
  } else {
    links.push(new Link('workbench', `Buy workbench (-$${VALUES.workbench})`, 'buy workbench', money >= VALUES.workbench))
  }

  // The forge
  if (rooms.forge) {
    links.push(new Link('forge', `Smelt copper (-${VALUES.cu} ore)`, 'smelt cu', cu >= VALUES.cu ))
    links.push(new Link('forge', `Smelt iron (-${VALUES.fe} ore)`, 'smelt fe', fe >= VALUES.fe ))
    links.push(new Link('forge', `Smelt mithril (-${VALUES.mi} ore)`, 'smelt mi', mi >= VALUES.mi ))
  } else {
    links.push(new Link('forge', `Build (-${VALUES.forge} rocks)`, 'build forge', rocks >= VALUES.forge ))
  }

  // The garden
  if (rooms.garden) {
    links.push(new Link('garden', `Meditate (-${meditateCost(inventory.stackLimit)} rocks)`, 'meditate', rocks >= meditateCost(inventory.stackLimit)))
  } else {
    links.push(new Link('garden', `Build (-${VALUES.garden} moss)`, 'build garden', moss >= VALUES.garden ))
  }

  // the gym
  if (rooms.gym) {
    links.push(new Link('gym', `Lift rocks (-${maxHp} rocks)`, 'train', rocks >= maxHp))
  } else {
    links.push(new Link('gym', `Build (-${VALUES.gym} rocks)`, 'build gym', rocks >= VALUES.gym))
  }
  
  return links
}

function meditateCost(stackLimit) {
  return 1
  const level = stackLimit / 5 - 1
  return 10 * Math.pow(2, level)  
}

export const actions = {}

actions['return-to-mine'] = (game) => {
  game.log('You yearn for the mines!')
  game.gameMode = 'mine'
}

actions['sell quartz'] = (game) => {
  if (game.stockpile.removeType('quartz')) {
    game.log('Selling a quartz')
    game.wallet.transact(VALUES.quartz)
  }
}

actions['buy workbench'] = (game) => {
  game.log('Buying a workbench')
  game.wallet.transact(-5)
  game.rooms.workbench = true
}

function charge(game, type, num) {
  const ids = game.stockpile.removeCount(type, num)
  ids.forEach(id => game.ecs.remove(id))
}

actions['build forge'] = (game) => {
  game.log('Building a forge')
  charge(game, 'rock', VALUES.forge)
  game.rooms.forge = true
}

actions['build garden'] = (game) => {
  game.log('Planting a garden')
  charge(game, 'moss', VALUES.garden)
  game.rooms.garden = true
}

actions['meditate'] = (game) => {
  game.log('As you ponder the stacked rocks, you see how to carry more in your bag')
  charge(game, 'rock', meditateCost(game.inventory.stackLimit))
  game.inventory.stackLimit += 5
}

actions['build gym'] = (game) => {
  game.log('Building a gym')
  charge(game, 'rock', VALUES.gym)
  game.rooms.gym = true
}

actions['train'] = (game) => {
  game.log('You deadlift some rocks. You feel stronger!')
  charge(game, 'rock', game.playerStats.maxHp)
  game.playerStats.maxHp += 5
  game.playerStats.hp += 5
}

const oreNames = { cu: 'copper', fe: 'iron', mi: 'mithril' }

Object.keys(oreNames).forEach((type) => {
  const name = oreNames[type]
  actions[`smelt ${type}`] = (game) => {
    game.log('Smelting an ingot')
    charge(game, `${name} ore`, VALUES[type])
    const id = makeIngot(game.ecs, `${name} ingot`)
    game.stockpile.giveItem(id)
  }
})