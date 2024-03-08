import { OnMap, Named, Display, Carryable, Sellable } from './components'

// Not EVERY type... but things with a lot of components,
// where we create them in more than one place, we'll have
// helper methods here:

// name is rock, quartz, copper ore, iron ore, mithril ore
export function makeMineral(ecs, name, loc) {
  return ecs.add({
    onMap: new OnMap(loc),
    named: new Named(name),
    display: new Display(name),
    carryable: new Carryable(name),
    stockable: true
  })
}

export function makeMoss(ecs, loc) {
  return ecs.add({
    onMap: new OnMap(loc),
    named: new Named('moss'),
    display: new Display('moss'),
    carryable: new Carryable('moss'),
    stockable: true
  })
}

export function makeIngot(ecs, name) {
  return ecs.add({
    named: new Named(name),
    carryable: new Carryable(name),
    stockable: true
  })
}