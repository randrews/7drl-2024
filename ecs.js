// A very basic ECS system
// - ecs.add({ [components] }) creates an entity, which returns the id
// - ecs.remove(id) removes an entity
// - ecs.removeComponent(id, type) removes a component from an entity
// - ecs.addComponent(id, type, component) adds a component to an entity
// - ecs.get(id) returns an entity and all its components
// - ecs.find([components], callback) loops through all entities calling the callback for each
//
// Example:
//   ecs = new ECS()
//   ecs.add({ location: [0, 0], pushable: true })
//   ecs.find(['location', 'pushable'], (id, [loc, _push]) => {
//     ecs.removeComponent(id, 'push')
//     loc[0]++
//   })

export default class ECS {
  constructor() {
    this.data = {}
    this.counter = 1
  }

  add(obj) {
    this.data[this.counter] = obj
    return this.counter++
  }

  get(id) {
    return this.data[id]
  }

  remove(id) {
    delete this.data[id]
    return this
  }

  removeComponent(id, type) {
    const ent = this.data[id]
    if (!ent) { return }
    delete ent[type]
    return this
  }

  addComponent(id, type, component) {
    const ent = this.data[id]
    if (!ent) { return }
    ent[type] = component
    return this
  }

  find(query, callback) {
    Object.keys(this.data).forEach((id) => {
      const ent = this.data[id]
      if (matches(query, ent)) {
        callback(id, query.map(c => ent[c]))
      }
    })
  }
}

const matches = (query, ent) => query.every(c => ent[c] !== undefined)
