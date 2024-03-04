import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client';

import * as Rot from 'rot-js'

import { simpleHash } from './util'
import Map from './map'
import ECS from './ecs'

class GameState {
  constructor() {
    this.map = new Map(80, 40)
    this.ecs = new ECS()

    const pos = this.map.validLadderPosition()

    // Add the player and the ladder to the world
    this.playerId = this.ecs.add({ onMap: new OnMap(pos)})
    this.ecs.add({ onMap: new OnMap(pos), hoverText: 'ladder (up or down)', display: 'ladder' })
      
    this.updateIndex()
  }

  draw(display) {
    // Draw map terrain
    this.map.draw(display)

    // Draw non-player objects on the map
    this.ecs.find(['onMap', 'display'], (_id, [onMap, type]) => {
      const [x, y] = [onMap.x, onMap.y]

      switch (type) {
      case 'ladder':
        display.draw(x, y, '=', '#dd0')
        break
      }
    })
    
    // Draw the player
    const [px, py] = this.playerPos
    display.draw(px, py, '@', '#fff', '#008')
  }
  
  get playerPos() {
    return this.ecs.get(this.playerId, 'onMap').pos
  }
  
  hover(pos) {
    // First try the index:
    const ent = this.index(this.toKey(pos))[0]
    if (ent) {
      return this.ecs.get(ent, 'hoverText')
    } else {
      const cell = this.map.at(pos)
      switch (cell.type) {
      case 'wall':
        if (!cell.exposed) { return '' } // Hidden is hidden!
        else if (cell.ore) { return `${cell.ore} ore` } // Show ore types
        else { return 'rock' } // plain old rock
        break
      case 'ladder':
        return 'ladder (up or down)'
        break
      }          
    }
  }
  
  // Build the index of onMap entities
  updateIndex() {
    this.index = this.ecs.index(['onMap', 'hoverText'], om => this.toKey(om.pos))
  }
  
  // Turn a position into an index key
  toKey([x, y]) {
    return x + y * this.map.w
  }
  
  // Handle a keycode and return whether it's one we care about
  keyPressed(key) {
    switch (key) {
    case 'ArrowDown':
      this.movePlayer([0, 1])
      return true
      break
    case 'ArrowUp':
      this.movePlayer([0, -1])
      return true
      break
    case 'ArrowLeft':
      this.movePlayer([-1, 0])
      return true
      break
    case 'ArrowRight':
      this.movePlayer([1, 0])
      return true
      break
    }
    
    return false
  }
  
  movePlayer([dx, dy]) {
    let [x, y] = this.playerPos
    const [mx, my] = this.map.size
    x += dx; y += dy
    if (x >= 0 && x < mx && y >= 0 && y < my) {
      this.ecs.get(this.playerId, 'onMap').pos = [x, y]
    }
  }
}

class Mob {
}

class OnMap {
  // type is optional
  constructor(pos) {
    this.pos = pos
  }
    
  get x() { return this.pos[0] }
  get y() { return this.pos[1] }
}

////////////////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.querySelector('.content'))
  const gs = new GameState()
  root.render(<Game game={gs} />)
}, false)

////////////////////////////////////////////////////////////////////////////////////////////////////

function Game({ game }) {
  const display = useMemo(() => new Rot.Display({ width: 80, height: 40 }), [])
  const [logLines, setLogLines] = useState(['foo', 'bar'])
  const log = useCallback((str) => {
    setLogLines((old) => ([str, ...old].slice(0, 8)))
  }, [setLogLines])
  const [tooltip, setTooltip] = useState('')
  const onHover = useCallback((pos) => {
    if (!pos) { // mouse is not hovering:
      setTooltip('')
    } else {
      setTooltip(game.hover(pos))
    }
  }, [setTooltip, game])
  const onKey = useCallback((event) => {
    if (game.keyPressed(event.key)) { event.preventDefault() }
    game.draw(display)
  }, [game, display])

  useEffect(() => game.draw(display), [display, game])

  return (
    <div className='game'>
    <Keyboard onKey={onKey} />
    <Screen display={display} onHover={onHover} />
    <Status tooltip={tooltip} />
    <Log lines={logLines} />
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function Keyboard({ onKey }) {
  useEffect(() => {
    const eh = window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])
  return ''
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function Screen({ display, onHover }) {
  const ref = useRef(null)
  const setStatus = useCallback(event => onHover(display.eventToPosition(event)), [onHover, display])
  const clearStatus = useCallback(_ => onHover(null), [onHover])

  useEffect(() => {
    ref.current.appendChild(display.getContainer())
    let ml = ref.current.addEventListener('mousemove', setStatus)
    let ll = ref.current.addEventListener('mouseleave', clearStatus)
    return () => {
      ref.current.removeEventListener('mousemove', ml)
      ref.current.removeEventListener('mouseleave', ll)
    }
  }, [ref.current, display, setStatus, clearStatus])

  return <div className='map' ref={ref}/>
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function Status({ game, tooltip }) {
  return (
    <div className='status'>
    {tooltip}
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function Log({ lines }) {
  const rows = [...lines].reverse().map((str) => <div key={simpleHash(str)}>{str}</div>)

  return (
    <div className='log'>
    {rows}
    </div>
  )
}
