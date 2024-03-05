import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client';

import * as Rot from 'rot-js'

import { simpleHash } from './util'
import Map from './map'
import ECS from './ecs'
import { OnMap } from './components'
import { GameState } from './game_state'

////////////////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.querySelector('.content'))
  const gs = new GameState()
  root.render(<Game game={gs} />)
}, false)

////////////////////////////////////////////////////////////////////////////////////////////////////

function Game({ game }) {
  const display = useMemo(() => new Rot.Display({ width: 80, height: 40 }), [])
  const [tooltip, setTooltip] = useState('')
  // We need something to trigger an update after key events, because the internal
  // game state will have changed. So we'll just increment this:
  const [turn, setTurn] = useState(0)
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
    setTurn(n => n + 1)
  }, [game, display, setTurn])

  useEffect(() => game.draw(display), [display, game])

  return (
    <div className='game'>
    <Keyboard onKey={onKey} />
    <Screen display={display} onHover={onHover} />
    <Status tooltip={tooltip} />
    <Log lines={game.logLines} />
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
  const rows = [...lines].reverse().map((str, i) => <div key={simpleHash(`${i} ${str}`)}>{str}</div>)

  return (
    <div className='log'>
      {rows}
    </div>
  )
}
