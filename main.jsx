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
  const [stockpile, setStockpile] = useState(() => game.stockpileStrings())
  const [ground, setGround] = useState(() => game.onGround())
  const [player, setPlayer] = useState(() => game.playerStrings())
  const [actions, setActions] = useState(() => game.actionStrings())
  const [workshopOptions, setWorkshopOptions] = useState(() => game.workshopOptions())

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
    setStockpile(game.stockpileStrings())
    setGround(game.onGround())
    setActions(game.actionStrings())
    setPlayer(game.playerStrings())
    setWorkshopOptions(game.workshopOptions())
  }, [game])

  const onKey = useCallback((event) => {
    if (game.keyPressed(event.key)) { event.preventDefault() }
    game.draw(display)
    updateEverything()
  }, [game, display, updateEverything])

  const onAction = useCallback((event) => {
    game.workshopAction(event.target.getAttribute('action'))
    updateEverything()
  }, [game, updateEverything])

  useEffect(() => game.draw(display), [display, game])

  let mainPanel, statusPanel
  if (game.gameMode === 'mine') {
    mainPanel = (<>
      <Keyboard onKey={onKey} />
      <Screen display={display} onHover={onHover} />
    </>)
    statusPanel = <Status tooltip={tooltip} inventory={inventory} ground={ground} actions={actions} player={player} />
  } else if (game.gameMode === 'workshop') {
    mainPanel = <Workshop game={game} onAction={onAction} options={workshopOptions} />
    statusPanel = <WorkshopStatus stockpile={stockpile} inventory={inventory} player={player} />
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
  - [DONE] rocks drop quartz 10% of the time
  - [DONE] sell quartz for money (1 ea)
  - [DONE] buy workbench with money ($5)
  - [DONE] use rocks to make forge, 10 rocks
  - [DONE] map has moss
  - [DONE] 5 moss to build garden
  - [DONE] rocks + garden increases stack limit (10 rocks -> 10 stack, 20 -> 15, 40 -> 20, etc)
  - [DONE] rocks to buy gym, rocks + gym increases max health (10 rocks -> +5, 15 -> +5, 20 -> +5, etc)
  - stamina? if there's time
  - [DONE] forge turns ores to ingots, 5:1 / 10:1 / 10:1 for cu / fe / mi
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

function Workshop({ game, onAction, options }) {
  const linkify = links => links.map(link => <WorkshopLink key={link.action} text={link.text} action={link.action} enabled={link.enabled} onAction={onAction}/>)
  const marketLinks = linkify(options.filter(o => o.room === 'market'))
  const mineLinks = linkify(options.filter(o => o.room === 'mine'))
  const forgeLinks = linkify(options.filter(o => o.room === 'forge'))
  const workbenchLinks = linkify(options.filter(o => o.room === 'workbench'))
  const gardenLinks = linkify(options.filter(o => o.room === 'garden'))
  const gymLinks = linkify(options.filter(o => o.room === 'gym'))

  return (
    <div className='workshop'>
      <div className='workstation market'>
        <div>market:</div><br/>
        {marketLinks}
      </div>
      <div className='workstation forge'>
        <div>forge</div><br/>
        {forgeLinks}
      </div>
      <div className='workstation garden'>
        <div>garden</div><br/>
        {gardenLinks}
      </div>
      <div className='workstation workbench'>
        <div>workbench</div><br/>
        {workbenchLinks}
      </div>
      <div className='workstation gym'>
        <div>gym</div><br/>
        {gymLinks}
      </div>
      <div className='workstation mine'>
        <div>mine:</div><br/>
        {mineLinks}
      </div>
    </div>
  )
}

function WorkshopLink({ text, action, enabled, onAction }) {
  if (enabled) {
    return <div className='button' onClick={onAction} action={action}>[{text}]</div>
  } else {
    return <div className='button disabled' action={action}>[{text}]</div>
  }
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

function Status({ tooltip, ground, actions, inventory, player }) {
  return (
    <div className='status'>
      <div className='tooltip'>{tooltip || '\u00A0'}</div>
      <div className='player'>Player:</div>
      {divList(player)}
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

function WorkshopStatus({ stockpile, inventory, player }) {
  return (
    <div className='status'>
      <br/>
      <div className='player'>Player:</div>
      {divList(player)}
      <br/>
      <div className='inventory'>Inventory:</div>
      {divList(inventory)}
      <br/>
      <div className='ground'>Stockpile:</div>
      {divList(stockpile)}
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
