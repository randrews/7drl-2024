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

    get(id, component) {
      if (component) {
        return this.data[id][component]
      } else {
        return this.data[id]        
      }
    }

    forEach(ids, query, callback) {
      ids.forEach((id) => {
        const ent = this.data[id]
        if (matches(query, ent)) {
          callback(id, query.map(c => ent[c]))
        }
      })
    }

    map(ids, query, callback) {
      const a = []
      this.forEach(ids, query, (id, cs) => a.push(callback(id, cs)))
      return a
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
      this.forEach(Object.keys(this.data), query, callback)
    }

    // We want to easily be able to find entities by map cell, but in a
    // somewhat morally pure way, so let's introduce the concept of an
    // index: given a component name and a callback component => val,
    // this will return a fn val => [id].
    // Imagine the component is onMap and the callback returns a position.
    // The returned index fn will give you a list of entities at that
    // position.
    index(query, fn) {
      const index = {}
      this.find(query, (id, comp) => {
        const key = fn(...comp)
        index[key] ||= []
        index[key].push(id)
      })

      return key => (index[key] || [])
    }
  }

  const matches = (query, ent) => query.every(c => ent[c] !== undefined)
