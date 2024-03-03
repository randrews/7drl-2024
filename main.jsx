import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client';

import * as Rot from 'rot-js'

import Map from './map'

function GameState() {
  this.map = new Map(80, 40)
}

////////////////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.querySelector('.content'))
  const gs = new GameState()
  root.render(<Game game={gs} />)
}, false)

function Game({ game }) {
  const display = useMemo(() => new Rot.Display({ width: 80, height: 40, fontSize: 16 }))
  const [logLines, setLogLines] = useState(['foo', 'bar'])
  const log = useCallback((str) => {
    setLogLines((old) => ([str, ...old].slice(0, 8)))
  }, [setLogLines])

  useEffect(() => game.map.draw(display), [display, game.map])

  return (
    <div className='game'>
      <Keyboard />
      <Screen display={display} />
      <Status />
      <Log lines={logLines} />
    </div>
  )
}

function Keyboard() {
  useEffect(() => {
    const eh = window.addEventListener('keydown', (e) => console.log(e))
    return () => window.removeEventListener(eh)
  }, [])
  return ''
}

function Screen({ display }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current.appendChild(display.getContainer())
  }, [ref.current, display])

  return <div className='map' ref={ref}/>
}

function Status({ game }) {
  return (
    <div className='status'>
      This is twenty long!
    </div>
  )
}

// From https://gist.github.com/jlevy/c246006675becc446360a798e2b2d781
const simpleHash = str => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function Log({ lines }) {
  const rows = [...lines].reverse().map((str) => <div key={simpleHash(str)}>{str}</div>)

  return (
    <div className='log'>
      {rows}
    </div>
  )
}
