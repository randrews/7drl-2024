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
  const [inventory, setInventory] = useState(() => game.inventoryStrings())
  const [ground, setGround] = useState(() => game.onGround())
  const [actions, setActions] = useState(() => game.actionStrings())

  const onHover = useCallback((pos) => {
    if (!pos) { // mouse is not hovering:
      setTooltip('')
    } else {
      setTooltip(game.hover(pos))
    }
  }, [setTooltip, game])

  const updateEverything = useCallback(() => {
    setLogLines(game.logLines)
    setInventory(game.inventoryStrings())
    setGround(game.onGround())
    setActions(game.actionStrings())    
  }, [game])

  const onKey = useCallback((event) => {
    if (game.keyPressed(event.key)) { event.preventDefault() }
    game.draw(display)
    updateEverything()
  }, [game, display, updateEverything])

  const onAction = useCallback((event) => {
    const act = event.target.getAttribute('action')
    game.log(`doin' a ${act}`)
    updateEverything()
  }, [game, updateEverything])

  useEffect(() => game.draw(display), [display, game])

  let mainPanel, statusPanel
  if (game.gameMode === 'mine') {
    mainPanel = (<>
      <Keyboard onKey={onKey} />
      <Screen display={display} onHover={onHover} />
    </>)
    statusPanel = <Status tooltip={tooltip} inventory={inventory} ground={ground} actions={actions} />
  } else if (game.gameMode === 'workshop') {
    mainPanel = <Workshop game={game} onAction={onAction} />
    statusPanel = <WorkshopStatus stocks={{}} inventory={inventory} />
  }

  return (
    <div className='game'>
      {mainPanel}
      {statusPanel}
      <Log lines={game.logLines} />
    </div>
  )
}

////////////////////////////////////////////////////////////////////////////////////////////////////

/*
  todo:
  - rocks drop quartz 10% of the time
  - sell quartz for money (1 ea)
  - buy workbench with money ($5)
  - use rocks to make forge, 10 rocks
  - map has moss, 5 moss to build garden
  - rocks + garden increases stack limit (10 rocks -> 10 stack, 20 -> 15, 40 -> 20, etc)
  - rocks to buy gym, rocks + gym increases max health (10 rocks -> +5, 15 -> +5, 20 -> +5, etc)
  - stamina? if there's time
  - forge turns ores to ingots, 5:1 / 10:1 / 10:1 for cu / fe / mi
  - sell trinkets $1 cu, $5 fe, $10 mi
  - sell gems also, $25
  - make trinkets with workbench (1 ingot ea)
  - make better pick with iron (10 ingots)
  - leather dropped by killing mobs, 25% chance
  - better pick is the only one that can mine gems and mithril
  - n mithril ingots + m gems = amulet of yendor
  - buy gloves: auto-pickup mined ore / gems (not rocks / qtz) $25
  - buy better packs: more inv slots (expensive though, $25 -> 5, $50 -> 10)
  - buy health potions, refill health to full, $1
*/

function Workshop({ game, onAction }) {
  const mineActions = [
    'return to mine',
  ]

  const marketActions = [
    'sell ingot',
    'buy potion'
  ]

  const makeLinks = (actions) => actions.map((act, i) => {
    return <div key={simpleHash(`${i} ${act}`)} className='button' onClick={onAction} action={act}>[{act}]</div>
  })

  const marketLinks = makeLinks(marketActions)
  const mineLinks = makeLinks(mineActions)

  return (
    <div className='workshop'>
      <div className='workstation mine'>
        <div>mine:</div><br/>
        {mineLinks}
      </div>
      <div className='workstation market'>
        <div>market:</div><br/>
        {marketLinks}
      </div>
      <div className='workstation forge'>forge</div>
      <div className='workstation workbench'>workbench</div>
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
    const el = ref.current
    el.appendChild(display.getContainer())
    const ml = ref.current.addEventListener('mousemove', setStatus)
    const ll = ref.current.addEventListener('mouseleave', clearStatus)
    return () => {
      el.removeEventListener('mousemove', ml)
      el.removeEventListener('mouseleave', ll)
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

function WorkshopStatus({ stocks, inventory }) {
  return (
    <div className='status'>
      <div className='inventory'>Inventory:</div>
      {divList(inventory)}
      <br/>
      <div className='ground'>Stockpile:</div>
      {divList([])}
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
