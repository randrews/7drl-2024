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
  const [logLines, setLogLines] = useState([])
  const [ground, setGround] = useState([])
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
    setLogLines(game.logLines)
    setGround(game.onGround())
  }, [game, display, setLogLines, setGround])

  useEffect(() => game.draw(display), [display, game])

  return (
    <div className='game'>
    <Keyboard onKey={onKey} />
    <Screen display={display} onHover={onHover} />
    <Status tooltip={tooltip} ground={ground} />
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

function divList(strs) {
  let divs = [<div className='item' key='none'>-nothing-</div>];
  if (strs?.length > 0) {
    divs = strs.map((str, i) => <div className='item' key={simpleHash(`${i} ${str}`)}>{str}</div>)
  }
  return divs
}

function Status({ tooltip, ground, actions, inventory }) {
  return (
    <div className='status'>
      <div className='tooltip'>{tooltip || '\u00A0'}</div>
      <br/>
      <div className='inventory'>Inventory:</div>
      {divList(inventory)}
      <br/>
      <div className='ground'>On ground:</div>
      {divList(ground)}
      <br/>
      <div className='actions'>Actions:</div>
      {divList(actions)}
      <br/>
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
