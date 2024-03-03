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
  }

  hover(pos) {
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

////////////////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.querySelector('.content'))
  const gs = new GameState()
  root.render(<Game game={gs} />)
}, false)

////////////////////////////////////////////////////////////////////////////////////////////////////

function Game({ game }) {
  const display = useMemo(() => new Rot.Display({ width: 80, height: 40, fontSize: 16 }), [])
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

  useEffect(() => game.map.draw(display), [display, game.map])

  return (
    <div className='game'>
      <Keyboard />
      <Screen display={display} onHover={onHover} />
      <Status tooltip={tooltip} />
      <Log lines={logLines} />
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function Keyboard() {
  useEffect(() => {
    const eh = window.addEventListener('keydown', (e) => console.log(e))
    return () => window.removeEventListener('keydown', eh)
  }, [])
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
