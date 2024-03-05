// A component for something that's on the map: it has a location and
// some flags for how it interacts with movement and LOS
export class OnMap {
  constructor(pos, flags) {
    this.pos = pos
    this.flags = flags || {}
  }
    
  get x() { return this.pos[0] }
  get y() { return this.pos[1] }
  
  // Solid objects cannot be moved through
  get solid() { return !!this.flags.solid }
  
  // Opaque objects cannot be seen through
  get opaque() { return !!this.flags.opaque }
}
