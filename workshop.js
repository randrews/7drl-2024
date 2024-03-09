import { VALUES, DEBUG } from './balance'
import { makeIngot, makePotion } from './types'

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
  const quartz = stockpile.countType('quartz')
  const moss = stockpile.countType('moss')
  const cu = stockpile.countType('copper ore')
  const fe = stockpile.countType('iron ore')
  const mi = stockpile.countType('mithril ore')
  const cuI = stockpile.countType('copper ingot')
  const feI = stockpile.countType('iron ingot')
  const miI = stockpile.countType('mithril ingot')
  const inventory = ecs.get(playerId, 'inventory')
  const player = ecs.get(playerId, 'player')
  const maxHp = player.maxHp

  const links = [
    new Link('mine', 'Return to mine', 'return-to-mine', true)
  ]

  // Selling things for money
  if (stockpile.hasAny('quartz')) { links.push(new Link('market', `Sell quartz (+$${VALUES.quartz})`, 'sell quartz', true)) }
  if (stockpile.hasAny('gem')) { links.push(new Link('market', `Sell gem (+$${VALUES.gem})`, 'sell gem', true)) }
  if (stockpile.hasAny('copper trinket')) { links.push(new Link('market', `Sell copper trinket (+$${VALUES.cuTrinket})`, 'sell cu trinket', true)) }
  if (stockpile.hasAny('iron trinket')) { links.push(new Link('market', `Sell iron trinket (+$${VALUES.feTrinket})`, 'sell fe trinket', true)) }
  if (stockpile.hasAny('mithril trinket')) { links.push(new Link('market', `Sell mithril trinket (+$${VALUES.miTrinket})`, 'sell mi trinket', true)) }
  links.push(new Link('market', `Buy larger pack (-$${packCost(inventory.inventoryLimit)})`, 'buy pack', money >= packCost(inventory.inventoryLimit)))

  if (DEBUG) {
    links.push(new Link('market', `cheat cu`, 'cheat cu', true))
    links.push(new Link('market', `cheat fe`, 'cheat fe', true))
    links.push(new Link('market', `cheat mi`, 'cheat mi', true))
    links.push(new Link('market', `cheat moss`, 'cheat moss', true))
    links.push(new Link('market', `cheat quartz`, 'cheat quartz', true))
    links.push(new Link('market', `cheat gem`, 'cheat gem', true))
  }

  // The workbench room
  if (rooms.workbench) {
    links.push(new Link('workbench', `Copper toy (-1 ingot)`, 'cu trinket', cuI > 0))
    links.push(new Link('workbench', `Iron tool (-1 ingot)`, 'fe trinket', feI > 0))
    links.push(new Link('workbench', `Mithril ring (-1 ingot)`, 'mi trinket', miI > 0))
    links.push(new Link('workbench', `Brew potion (-${VALUES.potion} moss)`, 'potion', moss >= VALUES.potion))
    links.push(new Link('workbench', `Gem sensor (-${VALUES.sensor} quartz)`, 'sensor', quartz >= VALUES.sensor))
    links.push(new Link('workbench', `Amulet of Yendor (-${VALUES.amGems} gems, -${VALUES.amMithril} MI)`, 'amulet', miI >= VALUES.amMithril && gems >= VALUES.amGems))
  } else {
    links.push(new Link('workbench', `Buy workbench (-$${VALUES.workbench})`, 'buy workbench', money >= VALUES.workbench))
  }

  // The forge
  if (rooms.forge) {
    links.push(new Link('forge', `Smelt copper (-${VALUES.cu} ore)`, 'smelt cu', cu >= VALUES.cu ))
    links.push(new Link('forge', `Smelt iron (-${VALUES.fe} ore)`, 'smelt fe', fe >= VALUES.fe ))
    links.push(new Link('forge', `Smelt mithril (-${VALUES.mi} ore)`, 'smelt mi', mi >= VALUES.mi ))
    links.push(new Link('forge', `Better pick (-${VALUES.pick} fe ingot)`, 'better pick', feI >= VALUES.pick))
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
  const level = stackLimit / 5 - 1
  return 10 * Math.pow(2, level)  
}

function packCost(currentLimit) {
  return 10 * (currentLimit - 2)
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

actions['sell gem'] = (game) => {
  if (game.stockpile.removeType('gem')) {
    game.log('Selling a gem')
    game.wallet.transact(VALUES.gem)
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

actions['better pick'] = (game) => {
  game.log('You craft a harder, stronger pickaxe!')
  charge(game, 'iron ingot', VALUES.pick)
  game.playerStats.tool = 'iron pickaxe'
  game.playerStats.dmg = 5
  game.playerStats.hardness = 2
}

actions['buy pack'] = (game) => {
  game.log('Can always use more space in the bag')
  game.wallet.transact(packCost(game.inventory.inventoryLimit) * -1)
  game.inventory.inventoryLimit++
}

actions['sensor'] = (game) => {
  game.log('You craft a sensor to detect gems')
  charge(game, 'quartz', VALUES.sensor)
  game.playerStats.gear.push('gem sensor')
  game.map.gemsVisible = true
  game.map.update()
}

actions['potion'] = (game) => {
  const id = makePotion(game.ecs)
  if (game.inventory.giveItem(id)) {
    game.log('You brew a health potion')
    charge(game, 'moss', VALUES.potion)
  } else {
    game.log('No room to carry another potion!')
    game.ecs.remove(id)
  }
}

actions['amulet'] = (game) => {
  game.log('You craft the amulet, and win the game!')
  game.gameMode = 'victory'
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

  actions[`${type} trinket`] = (game) => {
    game.log('Crafting a trinket')
    charge(game, `${name} ingot`, 1)
    const id = makeIngot(game.ecs, `${name} trinket`)
    game.stockpile.giveItem(id)
  }

  actions[`sell ${type} trinket`] = (game) => {
    game.log('Selling a trinket')
    charge(game, `${name} trinket`, 1)
    game.wallet.transact(VALUES[`${type}Trinket`])
  }

  actions[`cheat ${type}`] = (game) => {
    game.log(`Spawning ${name} ore`)
    const id = makeIngot(game.ecs, `${name} ore`)
    game.stockpile.giveItem(id)
  }
})

const names = ['moss', 'quartz', 'gem']
names.forEach((type) => {
  actions[`cheat ${type}`] = (game) => {
    game.log(`Spawning ${type}`)
    const id = makeIngot(game.ecs, type)
    game.stockpile.giveItem(id)
  }  
})