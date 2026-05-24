import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { AuthState } from '../App'
import { apiUrl, wsUrl } from '../lib/api'
import './GamePage.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props { auth: AuthState }

interface CardDef {
  id: string; name: string; type: string
  cost: { water?: number } | null
  data: Record<string, unknown>
}

interface CampSlot   { card_id: string; damage: number; destroyed: boolean }
interface PersonSlot { card_id: string; damage: number; ready: boolean; is_punk?: boolean }
interface EventSlot  { card_id: string; turns_remaining: number }

interface PlayerState {
  hand: string[]; water: number
  camps: CampSlot[]
  columns: (PersonSlot | null)[][]
  events: (EventSlot | null)[]
  raiders_in_play: boolean
  raiders_turns: number | null
  water_silo_in_play: boolean
}

interface GameStateData {
  deck: string[]; discard: string[]
  deck_cycles: number
  turn_context: { people_played_this_turn: number }
  players: Record<string, PlayerState>
}

interface GameInfo {
  game_id: number; status: string
  current_turn_player_id: number; turn_number: number
  winner_id: number | null; player1_id: number; player2_id: number
  state: GameStateData
}

type TargetSide = 'self' | 'opponent' | 'any'

type PendingAction =
  | { type: 'play_person'; cardId: string }
  | { type: 'play_event';  cardId: string }
  | { type: 'activate_ability'; colIdx: number; posIdx: number; abilityIdx: number; needsTarget: boolean; targetSide: TargetSide; targetType: 'person' | 'camp' }
  | { type: 'activate_camp';    campIdx: number; abilityIdx: number; needsTarget: boolean; targetSide: TargetSide; targetType: 'person' | 'camp' }

// ── Inline icon components (no emoji) ────────────────────────────────────────

const IcCamp    = () => <span className="ic ic-camp">◆</span>
const IcPerson  = () => <span className="ic ic-person">◉</span>
const IcEvent   = () => <span className="ic ic-event">★</span>
const IcRaiders = () => <span className="ic ic-raiders">▶</span>
const IcWater   = () => <span className="ic ic-water">◈</span>
const IcJunk    = () => <span className="ic ic-junk">⊗</span>
const IcPunk    = () => <span className="ic ic-punk">▪</span>
const IcDmg     = () => <span className="ic ic-damage">↯</span>
const IcTap     = () => <span className="ic" style={{ color: '#ff0080' }}>↺</span>

// ── Card description helpers (plain text, no emoji) ───────────────────────────

function describeTarget(t: unknown): string {
  if (!t) return ''
  if (typeof t === 'string') {
    const M: Record<string, string> = {
      unprotected: 'unprotected', opponent_choice: 'opp. choice',
      any: 'any', self: 'self', caller: 'this',
      one_of_your_people: 'your person', all_people: 'all people',
    }
    return M[t] ?? t
  }
  const o = t as Record<string, unknown>
  const side = String(o.side ?? '')
  switch (o.scope) {
    case 'one':    return side === 'enemy' ? 'enemy' : side === 'self' ? 'ally' : 'any'
    case 'all':    return side === 'enemy' ? 'all enemies' : side === 'self' ? 'all allies' : 'all'
    case 'column': return side === 'enemy' ? 'enemy col' : 'your col'
    case 'self':   return 'self'
  }
  if (!o.scope) {
    if (side === 'enemy') return 'all enemies'
    if (side === 'self')  return 'all allies'
    if (side === 'both')  return 'everyone'
  }
  return ''
}

function describeCampCond(c: Record<string, unknown>): string {
  switch (c.type) {
    case 'people_played_this_turn':    return `>=${c.value} ppl played`
    case 'raiders_resolved_this_turn': return 'raiders resolved'
    case 'event_resolved_this_turn':   return 'event resolved'
    case 'this_card_not_damaged':      return 'not damaged'
    case 'people_on_board':            return `<=${c.value} ppl`
    default: return String(c.type ?? '?').replace(/_/g, ' ')
  }
}

function describeEffect(e: unknown): string {
  if (!e) return ''
  const ef = e as Record<string, unknown>
  const amt = ef.value ?? ef.amount ?? 1
  switch (ef.type) {
    case 'damage':   return `↯${amt} ${describeTarget(ef.target)}`
    case 'destroy':  return `Destroy ${describeTarget(ef.target)}`
    case 'restore':  return `Restore ${describeTarget(ef.target)}`
    case 'injure':   return `Injure ${describeTarget(ef.target)}`
    case 'return':   return `Return ${describeTarget(ef.target)}`
    case 'ready':    return `Ready ${describeTarget(ef.target)}`
    case 'gain_water': return `+${amt} water`
    case 'draw':     return `Draw ${amt}`
    case 'discard':  return `Discard ${amt}`
    case 'gain_punk': return `+${amt ?? 1} punk`
    case 'flip_punk': return 'Punk → person'
    case 'raid':     return 'Raid ▶'
    case 'copy_ability':               return 'Copy ability'
    case 'peek_and_junk':              return `Peek ${ef.peek}, junk 1`
    case 'use_damaged_person_ability': return 'Use damaged person'
    case 'play_person_use_ability':    return 'Play+use person'
    case 'advance_event':              return 'Advance event'
    case 'discard_then_draw_plus_one': return 'Discard, draw+1'
    case 'opponent_damage_back':       return `Opp ↯${ef.value} back`
    case 'opponent_destroys_one_person': return 'Opp destroys person'
    case 'damage_unless_opponent_discards_two': return '↯1 or opp discards 2'
    case 'draw_select':    return `Draw ${ef.draw}, keep ${ef.keep}`
    case 'modify_state':   return 'All enemies unprotected'
    case 'move':           return 'Move event back 1T'
    case 'rearrange':      return 'Rearrange your people'
    case 'destroy_all_but_one': return 'Destroy all but 1 person'
    case 'draw_per_destroyed':  return 'Draw per destroyed camp'
    case 'choice': {
      const opts = (ef.options as unknown[]) ?? []
      return opts.map(describeEffect).join(' / ')
    }
    case 'sequence': {
      const steps = (ef.steps as unknown[]) ?? []
      return steps.map(describeEffect).join(' → ')
    }
    case 'conditional_effect': {
      const cond = ef.condition as Record<string, unknown>
      const then = (ef.then as unknown[]) ?? []
      return `If ${describeCampCond(cond)}: ${then.map(describeEffect).join(', ')}`
    }
    default: return String(ef.type ?? '?').replace(/_/g, ' ')
  }
}

function describePersonAbility(ab: Record<string, unknown>): string {
  const cost    = ab.cost as Record<string, unknown>
  const water   = (cost?.water as number) ?? 0
  const tap     = cost?.tap ? '↺ ' : ''
  const effects = (ab.effects as unknown[]) ?? []
  return `${tap}${water}◈ ${effects.map(describeEffect).join(' → ')}`
}

function describeCampAbility(ab: Record<string, unknown>): string {
  const water  = (ab.cost as number) ?? 0
  const cond   = ab.condition as Record<string, unknown> | undefined
  const cStr   = cond ? ` [${describeCampCond(cond)}]` : ''
  const costMod = ab.cost_modifier as Record<string, unknown> | undefined
  const modStr  = costMod
    ? ` (-1 per ${String(costMod.type ?? '').includes('punk') ? 'punk' : 'destroyed camp'})`
    : ''
  return `${water}◈${cStr}${modStr} ${describeEffect(ab.effect)}`
}

function describeJunk(card: CardDef): string {
  const junk = card.data.junk_effect as Record<string, unknown> | undefined
  const effects = (junk?.effects as unknown[]) ?? []
  if (!effects.length) return ''
  return effects.map(describeEffect).join(' → ')
}

// ── Game logic helpers ────────────────────────────────────────────────────────

function waterCost(c: CardDef): number { return c.cost?.water ?? 0 }

function effectsNeedTarget(effects: unknown[]): { needs: boolean; side: TargetSide; type: 'person' | 'camp' } {
  const flat: unknown[] = []
  for (const e of effects) {
    const ef = e as Record<string, unknown>
    if (ef.type === 'sequence') flat.push(...((ef.steps as unknown[]) ?? []))
    else flat.push(ef)
  }
  for (const e of flat) {
    const ef = e as Record<string, unknown>
    const t  = ef.target as Record<string, unknown> | undefined
    if (t && t.scope === 'one') {
      const side: TargetSide = t.side === 'enemy' ? 'opponent' : t.side === 'self' ? 'self' : 'any'
      return { needs: true, side, type: 'person' }
    }
  }
  return { needs: false, side: 'any', type: 'person' }
}

function getCampAbilityTarget(c: CardDef): { needs: boolean; side: TargetSide; type: 'person' | 'camp' } {
  const abilities = (c.data.ability as unknown[]) ?? []
  for (const ab of abilities) {
    const a = ab as Record<string, unknown>
    const e = a.effect as Record<string, unknown> | undefined
    if (e && typeof e.target === 'object' && e.target !== null) {
      const t = e.target as Record<string, unknown>
      if (t.scope === 'one') {
        const side: TargetSide = t.side === 'enemy' ? 'opponent' : 'any'
        return { needs: true, side, type: 'person' }
      }
    }
  }
  return { needs: false, side: 'any', type: 'person' }
}

const EMPTY_PLAYER: PlayerState = {
  hand: [], water: 0,
  camps: [
    { card_id: '', damage: 0, destroyed: false },
    { card_id: '', damage: 0, destroyed: false },
    { card_id: '', damage: 0, destroyed: false },
  ],
  columns: [[], [], []],
  events: [null, null, null],
  raiders_in_play: true,
  raiders_turns: null,
  water_silo_in_play: true,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GamePage({ auth }: Props) {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate   = useNavigate()
  const gid        = Number(gameId)

  const [cards, setCards]                       = useState<Record<string, CardDef>>({})
  const [gameInfo, setGameInfo]                 = useState<GameInfo | null>(null)
  const [gameState, setGameState]               = useState<GameStateData | null>(null)
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null)
  const [pendingAction, setPendingAction]       = useState<PendingAction | null>(null)
  const [error, setError]                       = useState<string | null>(null)
  const [dragSrc, setDragSrc]                   = useState<{ colIdx: number; posIdx: number } | null>(null)
  const [dragOver, setDragOver]                 = useState<{ colIdx: number; posIdx: number } | null>(null)
  const [dragHandCard, setDragHandCard]         = useState<string | null>(null)
  const ws  = useRef<WebSocket | null>(null)
  const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }

  const myId     = auth.userId
  const isMyTurn = gameInfo?.current_turn_player_id === myId

  useEffect(() => {
    async function init() {
      try {
        const [cRes, gRes] = await Promise.all([
          fetch(apiUrl('/cards'),        { headers: { Authorization: `Bearer ${auth.token}` } }),
          fetch(apiUrl(`/games/${gid}`), { headers: { Authorization: `Bearer ${auth.token}` } }),
        ])
        if (!cRes.ok || !gRes.ok) throw new Error('Failed to load game')
        const cData: CardDef[] = await cRes.json()
        const gData: GameInfo  = await gRes.json()
        const lookup: Record<string, CardDef> = {}
        cData.forEach(c => { lookup[c.id] = c })
        setCards(lookup)
        setGameInfo(gData)
        setGameState(gData.state)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load game')
      }
    }
    init()
  }, [gid])

  useEffect(() => {
    if (!gameInfo) return
    const socket = new WebSocket(wsUrl(`/ws/games/${gid}?token=${auth.token}`))
    ws.current = socket
    socket.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'game_state') {
          setGameInfo(prev => prev ? {
            ...prev,
            status: msg.status,
            current_turn_player_id: msg.current_turn_player_id,
            turn_number: msg.turn_number,
            winner_id: msg.winner_id,
          } : prev)
          setGameState(msg.state)
          setSelectedHandCard(null)
          setPendingAction(null)
          setDragSrc(null)
          setDragOver(null)
          setDragHandCard(null)
        }
      } catch { /* ignore */ }
    }
    socket.onerror = () => setError('WebSocket connection error')
    return () => { socket.close() }
  }, [gameInfo?.game_id])

  async function post(path: string, body: Record<string, unknown>) {
    try {
      const res  = await fetch(apiUrl(path), { method: 'POST', headers: hdr, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Action failed'); return false }
      if (data.state) { setGameState(data.state); setSelectedHandCard(null); setPendingAction(null) }
      return true
    } catch { setError('Network error'); return false }
  }

  async function endTurn()                           { await post(`/games/end-turn/${gid}`, {}) }
  async function junkCard(id: string)                { setPendingAction(null); setSelectedHandCard(null); await post(`/games/junk-card/${gid}`, { card_id: id }) }
  async function playPerson(id: string, col: number, posIdx?: number) {
    setPendingAction(null); setSelectedHandCard(null)
    const body: Record<string, unknown> = { card_id: id, column_index: col }
    if (posIdx !== undefined) body.position_index = posIdx
    await post(`/games/play-person/${gid}`, body)
  }
  async function playEvent(id: string, slot: number) { setPendingAction(null); setSelectedHandCard(null); await post(`/games/play-event/${gid}`, { card_id: id, queue_slot: slot }) }
  async function takeWaterSilo()                     { await post(`/games/take-water-silo/${gid}`, {}) }
  async function repositionPerson(colIdx: number)    { setDragSrc(null); setDragOver(null); await post(`/games/reposition-person/${gid}`, { column_index: colIdx }) }

  async function resignGame() {
    if (!window.confirm('Resign this game? You will be marked as the loser.')) return
    try { await fetch(apiUrl(`/games/resign/${gid}`), { method: 'POST', headers: hdr }) } catch { /* ignore */ }
    navigate('/play')
  }

  async function activateAbility(
    colIdx: number, posIdx: number, abilityIdx: number,
    target?: { type: 'person' | 'camp'; side: 'self' | 'opponent'; col?: number; pos?: number; campIdx?: number }
  ) {
    const body: Record<string, unknown> = { column_index: colIdx, position_index: posIdx, ability_index: abilityIdx }
    if (target) {
      body.target_type = target.type; body.target_side = target.side
      if (target.col     !== undefined) body.target_column     = target.col
      if (target.pos     !== undefined) body.target_position   = target.pos
      if (target.campIdx !== undefined) body.target_camp_index = target.campIdx
    }
    setPendingAction(null); setSelectedHandCard(null)
    await post(`/games/activate-ability/${gid}`, body)
  }

  async function activateCamp(
    campIdx: number, abilityIdx: number,
    target?: { type: 'person' | 'camp'; side: 'self' | 'opponent'; col?: number; pos?: number; campIdx?: number }
  ) {
    const body: Record<string, unknown> = { camp_index: campIdx, ability_index: abilityIdx }
    if (target) {
      body.target_type = target.type; body.target_side = target.side
      if (target.col     !== undefined) body.target_column     = target.col
      if (target.pos     !== undefined) body.target_position   = target.pos
      if (target.campIdx !== undefined) body.target_camp_index = target.campIdx
    }
    setPendingAction(null); setSelectedHandCard(null)
    await post(`/games/activate-camp/${gid}`, body)
  }

  function handleTargetPerson(side: 'self' | 'opponent', col: number, pos: number) {
    if (!pendingAction) return
    if (pendingAction.type === 'activate_ability')
      activateAbility(pendingAction.colIdx, pendingAction.posIdx, pendingAction.abilityIdx, { type: 'person', side, col, pos })
    else if (pendingAction.type === 'activate_camp')
      activateCamp(pendingAction.campIdx, pendingAction.abilityIdx, { type: 'person', side, col, pos })
  }

  function handleTargetCamp(side: 'self' | 'opponent', campIdx: number) {
    if (!pendingAction) return
    if (pendingAction.type === 'activate_ability')
      activateAbility(pendingAction.colIdx, pendingAction.posIdx, pendingAction.abilityIdx, { type: 'camp', side, campIdx })
    else if (pendingAction.type === 'activate_camp')
      activateCamp(pendingAction.campIdx, pendingAction.abilityIdx, { type: 'camp', side, campIdx })
  }

  const cancel = useCallback(() => { setPendingAction(null); setSelectedHandCard(null) }, [])

  if (!gameInfo || !gameState) {
    return <div className="gp-loading">LOADING GAME…</div>
  }

  const oppId  = gameInfo.player1_id === myId ? gameInfo.player2_id : gameInfo.player1_id
  const me     = gameState.players[String(myId)]  ?? EMPTY_PLAYER
  const opp    = gameState.players[String(oppId)] ?? EMPTY_PLAYER

  const isTargeting = !!(
    pendingAction &&
    (pendingAction.type === 'activate_ability' || pendingAction.type === 'activate_camp') &&
    pendingAction.needsTarget
  )
  const targetInfo = (isTargeting && pendingAction &&
    (pendingAction.type === 'activate_ability' || pendingAction.type === 'activate_camp'))
    ? { side: pendingAction.targetSide, type: pendingAction.targetType }
    : null

  function isPersonTarget(side: 'self' | 'opponent') {
    return !!(targetInfo && (targetInfo.side === side || targetInfo.side === 'any') && targetInfo.type === 'person')
  }
  function isCampTarget(side: 'self' | 'opponent') {
    return !!(targetInfo && (targetInfo.side === side || targetInfo.side === 'any') && targetInfo.type === 'camp')
  }

  const def = (id: string) => cards[id]

  if (gameInfo.status === 'finished') {
    const iWon   = gameInfo.winner_id === myId
    const isDraw = gameInfo.winner_id === null
    return (
      <div className="gp-root">
        <div className="gp-overlay">
          <div className="gp-overlay-box">
            <div className={`gp-ov-title ${isDraw ? 'draw' : iWon ? 'win' : 'lose'}`}>
              {isDraw ? 'DRAW' : iWon ? 'VICTORY' : 'DEFEAT'}
            </div>
            <div className="gp-ov-sub">
              {isDraw ? 'The wasteland claims you both.' : iWon ? 'You razed their camps.' : 'Your camps lie in ruin.'}
            </div>
            <button className="gp-ov-btn" onClick={() => navigate('/play')}>BACK TO LOBBY</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Shared renders ────────────────────────────────────────────────────────────

  function renderPips(damage: number, max = 2) {
    return (
      <div className="gp-pips">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`gp-pip${i < damage ? ' hit' : ''}`} />
        ))}
      </div>
    )
  }

  // ── Punk card ─────────────────────────────────────────────────────────────
  function renderPunkCard(slot: PersonSlot, side: 'self' | 'opponent', colIdx: number, posIdx: number) {
    const isValidTarget = isPersonTarget(side)

    function click() {
      if (isTargeting && isValidTarget) { handleTargetPerson(side, colIdx, posIdx) }
    }

    const cls = [
      'gp-card gp-person gp-punk',
      isValidTarget ? 'target-valid clickable' : '',
    ].filter(Boolean).join(' ')

    return (
      <div key={`punk${colIdx}-${posIdx}`} className={cls} onClick={click}>
        <div className="gp-card-head">
          <IcPunk />
          <span className="gp-card-title">PUNK</span>
          <span className="gp-card-cost-badge" style={{ color: '#8880aa' }}>1HP</span>
        </div>
        <div className="gp-card-body">
          <div className="gp-ability-line gp-ability-trait">Face-down · protects camp</div>
        </div>
        <div className="gp-card-foot">{renderPips(slot.damage, 1)}</div>
      </div>
    )
  }

  // ── Person card ────────────────────────────────────────────────────────────
  function renderPersonCard(slot: PersonSlot, side: 'self' | 'opponent', colIdx: number, posIdx: number) {
    if (slot.is_punk) return renderPunkCard(slot, side, colIdx, posIdx)

    const d       = def(slot.card_id)
    const tapped  = !slot.ready
    const isValidTarget = isPersonTarget(side)
    const isSelected    = pendingAction?.type === 'activate_ability' &&
      side === 'self' && pendingAction.colIdx === colIdx && pendingAction.posIdx === posIdx
    const abilities    = (d?.data.activated_abilities as unknown[]) ?? []
    const enterEffect  = d?.data.enter_effect as Record<string, unknown> | undefined
    const enterEffects = (enterEffect?.effects as unknown[]) ?? []
    const junkDesc     = d ? describeJunk(d) : ''
    const trait        = d?.data.trait as string | undefined
    const canActivate  = isMyTurn && side === 'self' && abilities.length > 0

    const col     = (side === 'self' ? me : opp).columns[colIdx] ?? []
    const canDrag = isMyTurn && side === 'self' && col.length === 2
    const isDragSrc  = dragSrc?.colIdx === colIdx && dragSrc?.posIdx === posIdx && side === 'self'
    const isDragOver = dragOver?.colIdx === colIdx && dragOver?.posIdx === posIdx && side === 'self'

    // "Deploy to front" target: this person is at front row (posIdx==0), column has 1 person,
    // and we're in play_person mode. Clicking pushes them to back and deploys new card to front.
    const handCard = dragHandCard ? cards[dragHandCard] : null
    const isDeployFrontTarget = side === 'self' && isMyTurn && posIdx === 0 && col.length === 1 &&
      (pendingAction?.type === 'play_person' ||
       (dragHandCard !== null && handCard?.type === 'person' && me.water >= waterCost(handCard ?? { id:'',name:'',type:'',cost:null,data:{} })))

    function click() {
      if (isTargeting && isValidTarget) { handleTargetPerson(side, colIdx, posIdx); return }
      if (isDeployFrontTarget && pendingAction?.type === 'play_person') {
        playPerson((pendingAction as { type: 'play_person'; cardId: string }).cardId, colIdx, 0)
        return
      }
      if (dragSrc) return
      if (!canActivate) return
      const ab = abilities[0] as Record<string, unknown>
      const { needs, side: tSide, type: tType } = effectsNeedTarget((ab.effects as unknown[]) ?? [])
      setPendingAction({ type: 'activate_ability', colIdx, posIdx, abilityIdx: 0, needsTarget: needs, targetSide: tSide, targetType: tType })
      setSelectedHandCard(null)
      if (!needs) activateAbility(colIdx, posIdx, 0)
    }

    const cls = [
      'gp-card gp-person',
      tapped        ? 'tapped'       : '',
      isValidTarget ? 'target-valid clickable' : '',
      isDeployFrontTarget && !isValidTarget ? 'target-valid clickable' : '',
      isSelected    ? 'selected'     : '',
      canActivate && !isValidTarget && !isDeployFrontTarget ? 'clickable' : '',
      canDrag && !isDragSrc ? 'draggable' : '',
      isDragSrc  ? 'selected' : '',
      isDragOver ? 'drag-over' : '',
    ].filter(Boolean).join(' ')

    return (
      <div
        key={`p${colIdx}-${posIdx}`}
        className={cls}
        onClick={click}
        draggable={canDrag}
        onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragSrc({ colIdx, posIdx }) } : undefined}
        onDragEnd={() => { setDragSrc(null); setDragOver(null) }}
        onDragOver={(canDrag || isDeployFrontTarget) ? (e) => { e.preventDefault(); if (canDrag) setDragOver({ colIdx, posIdx }) } : undefined}
        onDrop={dragSrc && dragSrc.colIdx === colIdx && dragSrc.posIdx !== posIdx && side === 'self'
          ? (e) => { e.preventDefault(); repositionPerson(colIdx) }
          : isDeployFrontTarget && dragHandCard
            ? (e) => { e.preventDefault(); playPerson(dragHandCard, colIdx, 0); setDragHandCard(null) }
            : undefined}
      >
        <div className="gp-card-head">
          <IcPerson />
          <span className="gp-card-title">{d?.name ?? slot.card_id}</span>
          {tapped && <IcTap />}
          <span className="gp-card-cost-badge">{waterCost(d ?? { id: '', name: '', type: '', cost: null, data: {} })}◈</span>
        </div>
        <div className="gp-card-body">
          {isDeployFrontTarget && !isValidTarget && (
            <div className="gp-ability-line" style={{ color: '#ff0080', fontWeight: 'bold' }}>
              ↑ DEPLOY HERE → push to back
            </div>
          )}
          {abilities.slice(0, 2).map((ab, i) => (
            <div key={i} className="gp-ability-line gp-ability-active">
              {describePersonAbility(ab as Record<string, unknown>)}
            </div>
          ))}
          {enterEffects.length > 0 && (
            <div className="gp-ability-line gp-ability-enter">
              ▶ {enterEffects.map(describeEffect).join(' → ')}
            </div>
          )}
          {trait && (
            <div className="gp-ability-line gp-ability-trait">
              {trait.replace(/_/g, ' ')}
            </div>
          )}
          {junkDesc && (
            <div className="gp-ability-line gp-ability-junk">
              <IcJunk /> {junkDesc}
            </div>
          )}
        </div>
        <div className="gp-card-foot">{renderPips(slot.damage)}</div>
      </div>
    )
  }

  // ── Camp card ──────────────────────────────────────────────────────────────
  function renderCampCard(camp: CampSlot, side: 'self' | 'opponent', campIdx: number) {
    const d         = def(camp.card_id)
    const isValidTarget = isCampTarget(side)
    const abilities = (d?.data?.ability as unknown[]) ?? []
    const passive   = (d?.data?.passive as unknown[]) ?? []
    const trait     = d?.data?.trait as string | undefined
    const initDraw  = d?.data?.initial_draw as number | undefined
    const canActivate = isMyTurn && side === 'self' && !camp.destroyed && abilities.length > 0

    function click() {
      if (isTargeting && isValidTarget) { handleTargetCamp(side, campIdx); return }
      if (!canActivate || !d) return
      const { needs, side: tSide, type: tType } = getCampAbilityTarget(d)
      const cost = ((abilities[0] as Record<string, unknown>).cost as number) ?? 0
      if (me.water < cost) { setError(`Need ${cost}◈ (have ${me.water})`); return }
      setPendingAction({ type: 'activate_camp', campIdx, abilityIdx: 0, needsTarget: needs, targetSide: tSide, targetType: tType })
      setSelectedHandCard(null)
      if (!needs) activateCamp(campIdx, 0)
    }

    const cls = [
      'gp-card gp-camp',
      camp.destroyed    ? 'destroyed'    : '',
      isValidTarget     ? 'target-valid clickable' : '',
      canActivate && !isValidTarget ? 'clickable' : '',
    ].filter(Boolean).join(' ')

    return (
      <div key={`c${campIdx}`} className={cls} onClick={click}>
        <div className="gp-card-head">
          <IcCamp />
          <span className="gp-card-title">{d?.name ?? camp.card_id}</span>
          {initDraw !== undefined && initDraw > 0 && (
            <span className="gp-card-cost-badge">+{initDraw}</span>
          )}
        </div>
        <div className="gp-card-body">
          {abilities.slice(0, 2).map((ab, i) => (
            <div key={i} className="gp-ability-line gp-ability-active">
              {describeCampAbility(ab as Record<string, unknown>)}
            </div>
          ))}
          {passive.slice(0, 1).map((p, i) => {
            const pa = p as Record<string, unknown>
            return (
              <div key={`pa${i}`} className="gp-ability-line gp-ability-trait">
                {pa.type === 'column_cost_reduction'
                  ? `−${pa.amount}◈ cost if no people`
                  : String(pa.type).replace(/_/g, ' ')}
              </div>
            )
          })}
          {trait && (
            <div className="gp-ability-line gp-ability-trait">
              {trait.replace(/_/g, ' ')}
            </div>
          )}
          {camp.destroyed && <div className="gp-destroyed-text">DESTROYED</div>}
        </div>
        <div className="gp-card-foot">{renderPips(camp.damage)}</div>
      </div>
    )
  }

  // ── Event slot ─────────────────────────────────────────────────────────────
  function renderEventSlot(slot: EventSlot | null, idx: number, side: 'self' | 'opponent') {
    const isDropTarget = pendingAction?.type === 'play_event' && side === 'self' && !slot

    if (slot) {
      const d          = def(slot.card_id)
      const playEffect = d?.data.play_effect as Record<string, unknown> | undefined
      const effects    = (playEffect?.effects as unknown[]) ?? []
      const fuse       = d?.data.fuse as number ?? 3

      return (
        <div key={`ev${idx}`} className="gp-card gp-event">
          <div className="gp-card-head">
            <IcEvent />
            <span className="gp-card-title">{d?.name ?? slot.card_id}</span>
            <span className="gp-card-cost-badge">{slot.turns_remaining}T</span>
          </div>
          <div className="gp-card-body">
            {effects.length > 0 && (
              <div className="gp-ability-line gp-ability-active">
                {effects.map(describeEffect).join(' → ')}
              </div>
            )}
          </div>
          <div className="gp-fuse-wrap">
            <div className="gp-fuse-track">
              <div className="gp-fuse-fill"
                style={{ width: `${fuse > 0 ? (slot.turns_remaining / fuse) * 100 : 100}%` }}
              />
            </div>
          </div>
        </div>
      )
    }

    const handCard = dragHandCard ? cards[dragHandCard] : null
    const isHandEventDrop = dragHandCard !== null && side === 'self' && !slot &&
      handCard?.type === 'event' && me.water >= waterCost(handCard ?? { id:'',name:'',type:'',cost:null,data:{} })

    return (
      <div
        key={`ev${idx}`}
        className={`gp-card gp-event gp-event-empty${(isDropTarget || isHandEventDrop) ? ' drop-target' : ''}`}
        onClick={() => {
          if (isDropTarget)
            playEvent((pendingAction as { type: 'play_event'; cardId: string }).cardId, idx)
        }}
        onDragOver={(isDropTarget || isHandEventDrop) ? (e) => e.preventDefault() : undefined}
        onDrop={isHandEventDrop
          ? (e) => { e.preventDefault(); playEvent(dragHandCard!, idx); setDragHandCard(null) }
          : undefined}
      >
        {isDropTarget || isHandEventDrop
          ? <span className="gp-drop-label">QUEUE</span>
          : <span className="gp-slot-label">OPEN</span>
        }
      </div>
    )
  }

  // ── Events column (left side) ──────────────────────────────────────────────
  function renderEventsCol(player: PlayerState, side: 'self' | 'opponent') {
    const slots = [player.events[0] ?? null, player.events[1] ?? null, player.events[2] ?? null]
    const raidersQueued = !(player.raiders_in_play ?? true) && (player.raiders_turns ?? null) !== null

    return (
      <div className="gp-col gp-events-col">
        <div className="gp-events-col-label">EVENTS</div>
        {slots.map((s, i) => renderEventSlot(s, i, side))}
        {raidersQueued && (
          <div className="gp-card gp-event" style={{ flex: 'none', minHeight: 50, flexShrink: 0 }}>
            <div className="gp-card-head" style={{ background: '#140600' }}>
              <IcRaiders />
              <span className="gp-card-title" style={{ color: '#f97316' }}>RAIDERS</span>
              <span className="gp-card-cost-badge" style={{ color: '#f97316' }}>
                {player.raiders_turns === 1 ? '①' : '②'}
              </span>
            </div>
            <div className="gp-card-body">
              <div className="gp-ability-line" style={{ color: '#f97316' }}>
                Damages opp camp
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Play area panel (right side) ───────────────────────────────────────────
  function renderPlayAreaPanel(player: PlayerState, side: 'self' | 'opponent') {
    const raidersInPlay = player.raiders_in_play ?? true
    const raidersTurns  = player.raiders_turns ?? null
    const siloInPlay    = player.water_silo_in_play ?? true
    const siloInHand    = !siloInPlay

    return (
      <div className="gp-col gp-play-area">
        {/* Water */}
        <div className="gp-water-panel">
          <div className="gp-water-label"><IcWater /> WATER</div>
          <div className="gp-water-num">{player.water}</div>
          <div className="gp-water-dots">
            {Array.from({ length: Math.max(player.water, 3) }, (_, i) => (
              <div key={i} className={`gp-wdot${i < player.water ? ' on' : ''}`} />
            ))}
          </div>
        </div>

        {/* Raiders */}
        <div className="gp-raiders-card">
          <div className="gp-raiders-label"><IcRaiders /> RAIDERS</div>
          {raidersInPlay ? (
            <div className="gp-raiders-status in-play">IN PLAY</div>
          ) : (
            <div className="gp-raiders-status queued">
              {raidersTurns === 1 ? '①' : '②'}
            </div>
          )}
          <div className="gp-raiders-desc">
            Raid → place ②.<br/>Resolves → <IcDmg /> opp camp
          </div>
        </div>

        {/* Water Silo */}
        <div className="gp-silo-card">
          <div className="gp-silo-label"><IcWater /> WATER SILO</div>
          {siloInPlay ? (
            <>
              <div className="gp-silo-status in-play">IN PLAY</div>
              {side === 'self' && isMyTurn && (
                <button
                  className="gp-take-silo-btn"
                  onClick={takeWaterSilo}
                  disabled={player.water < 1}
                >
                  TAKE (1◈)
                </button>
              )}
            </>
          ) : (
            <div className="gp-silo-status in-hand">IN HAND</div>
          )}
          <div className="gp-silo-desc">
            {siloInHand ? 'Junk → +1◈, back here' : 'Spend 1◈ to take'}
          </div>
        </div>

        {side === 'opponent' && (
          <div className="gp-handcount-info">Hand: {player.hand.length}</div>
        )}
      </div>
    )
  }

  // ── Camp column ────────────────────────────────────────────────────────────
  function renderCampCol(player: PlayerState, side: 'self' | 'opponent', colIdx: number) {
    const camp       = player.camps[colIdx]
    const col        = player.columns[colIdx] ?? []
    const person0    = col[0] ?? null
    const person1    = col[1] ?? null
    const isPlayTarget = pendingAction?.type === 'play_person' && side === 'self' && col.length < 2

    const emptySlot = (posIdx: number) => {
      const isDragTarget = dragSrc?.colIdx === colIdx && side === 'self' &&
        dragSrc.posIdx !== posIdx && col.length === 2
      const handCard = dragHandCard ? cards[dragHandCard] : null
      const isHandPersonDrop = dragHandCard !== null && side === 'self' && col.length < 2 &&
        handCard?.type === 'person' && me.water >= waterCost(handCard ?? { id:'',name:'',type:'',cost:null,data:{} })

      return (
        <div
          key={`ep${colIdx}-${posIdx}`}
          className={[
            'gp-card empty-slot',
            isPlayTarget || isHandPersonDrop ? 'drop-target' : '',
            isDragTarget ? 'drag-over' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => {
            if (isPlayTarget)
              playPerson((pendingAction as { type: 'play_person'; cardId: string }).cardId, colIdx, posIdx)
          }}
          onDragOver={(isDragTarget || isHandPersonDrop) ? (e) => e.preventDefault() : undefined}
          onDrop={isDragTarget
            ? (e) => { e.preventDefault(); repositionPerson(colIdx) }
            : isHandPersonDrop
              ? (e) => { e.preventDefault(); playPerson(dragHandCard!, colIdx, posIdx); setDragHandCard(null) }
              : undefined}
        >
          {isPlayTarget || isHandPersonDrop
            ? <span className="gp-drop-label">DEPLOY</span>
            : isDragTarget
              ? <span className="gp-drop-label">MOVE</span>
              : <span className="gp-slot-label">—</span>
          }
        </div>
      )
    }

    const renderSlot = (posIdx: number) => {
      const person = posIdx === 0 ? person0 : person1
      if (person) return renderPersonCard(person, side, colIdx, posIdx)
      return emptySlot(posIdx)
    }

    return (
      <div key={`col${side}${colIdx}`} className="gp-col">
        {side === 'opponent' ? (
          <>
            {renderCampCard(camp, 'opponent', colIdx)}
            {renderSlot(1)}
            {renderSlot(0)}
          </>
        ) : (
          <>
            {renderSlot(0)}
            {renderSlot(1)}
            {renderCampCard(camp, 'self', colIdx)}
          </>
        )}
      </div>
    )
  }

  // ── Player board ───────────────────────────────────────────────────────────
  function renderPlayerBoard(player: PlayerState, side: 'self' | 'opponent') {
    return (
      <div className="gp-section">
        <div className="gp-player-bar">
          <span className="gp-pname">
            {side === 'self' ? `YOU · ${auth.username.toUpperCase()}` : `OPPONENT · #${oppId}`}
          </span>
          {side === 'self'     && isMyTurn  && <span className="gp-turn-badge yours">YOUR TURN</span>}
          {side === 'opponent' && !isMyTurn && <span className="gp-turn-badge theirs">THEIR TURN</span>}
        </div>
        <div className="gp-grid">
          {renderEventsCol(player, side)}
          {renderCampCol(player, side, 0)}
          {renderCampCol(player, side, 1)}
          {renderCampCol(player, side, 2)}
          {renderPlayAreaPanel(player, side)}
        </div>
      </div>
    )
  }

  // ── Action panel ───────────────────────────────────────────────────────────
  function renderActionPanel() {
    if (isTargeting && pendingAction) {
      const pa = pendingAction as { targetType: string; targetSide: string }
      const where = pa.targetSide === 'opponent' ? "opponent's board"
        : pa.targetSide === 'self' ? 'your board' : 'the board'
      return (
        <div className="gp-action-panel targeting">
          <div className="gp-action-hint">
            SELECT TARGET — click a {pa.targetType.toUpperCase()} on {where}
          </div>
          <div className="gp-action-btns">
            <button className="gp-abtn cancel" onClick={cancel}>CANCEL</button>
          </div>
        </div>
      )
    }
    if (pendingAction?.type === 'play_person' || pendingAction?.type === 'play_event') {
      return (
        <div className="gp-action-panel targeting">
          <div className="gp-action-hint">
            {pendingAction.type === 'play_person'
              ? 'Click an empty person slot to deploy'
              : 'Click an empty event slot to queue'}
          </div>
          <div className="gp-action-btns">
            <button className="gp-abtn cancel" onClick={cancel}>CANCEL</button>
          </div>
        </div>
      )
    }
    if (selectedHandCard) {
      // Water Silo
      if (selectedHandCard === '__water_silo__') {
        return (
          <div className="gp-action-panel">
            <div className="gp-action-info">
              <span className="gp-action-name">Water Silo</span>
              <span className="gp-action-cost">Junk → +1◈, returns to play area</span>
            </div>
            <div className="gp-action-btns">
              {isMyTurn && (
                <button className="gp-abtn junk" onClick={() => junkCard(selectedHandCard)}>
                  JUNK (+1◈)
                </button>
              )}
              <button className="gp-abtn cancel" onClick={cancel}>CANCEL</button>
            </div>
          </div>
        )
      }

      const d = def(selectedHandCard)
      if (!d) return null
      const cost      = waterCost(d)
      const canAfford = me.water >= cost
      const junkDesc  = describeJunk(d)
      return (
        <div className="gp-action-panel">
          <div className="gp-action-info">
            <span className="gp-action-name">{d.name}</span>
            <span className="gp-action-cost">{cost}◈ to play</span>
            {junkDesc && <span style={{ fontSize: 9, color: '#6b4a9b', marginLeft: 6 }}>junk: {junkDesc}</span>}
          </div>
          <div className="gp-action-btns">
            {d.type === 'person' && isMyTurn && canAfford && (
              <button className="gp-abtn deploy"
                onClick={() => setPendingAction({ type: 'play_person', cardId: selectedHandCard })}>
                DEPLOY
              </button>
            )}
            {d.type === 'event' && isMyTurn && canAfford && (
              <button className="gp-abtn queue"
                onClick={() => setPendingAction({ type: 'play_event', cardId: selectedHandCard })}>
                QUEUE
              </button>
            )}
            {isMyTurn && (
              <button className="gp-abtn junk" onClick={() => junkCard(selectedHandCard)}>JUNK</button>
            )}
            <button className="gp-abtn cancel" onClick={cancel}>CANCEL</button>
          </div>
          {!canAfford && isMyTurn && (
            <div className="gp-action-warn">Need {cost}◈ · have {me.water}</div>
          )}
        </div>
      )
    }
    return null
  }

  // ── Hand ───────────────────────────────────────────────────────────────────
  function renderHand() {
    const hand = me.hand
    return (
      <div className="gp-hand-section">
        <div className="gp-hand-bar">
          <span className="gp-hand-lbl">HAND</span>
          <span className="gp-hand-count">{hand.length} cards</span>
          <span className="gp-hand-water"><IcWater /> {me.water}</span>
        </div>
        <div className="gp-hand-scroll">
          {hand.length === 0 && <span className="gp-hand-empty">HAND IS EMPTY</span>}
          {hand.map(cid => {
            // Water Silo special card
            if (cid === '__water_silo__') {
              return (
                <div
                  key={cid}
                  className={['gp-hcard', selectedHandCard === cid ? 'selected' : '', !isMyTurn ? 'not-my-turn' : ''].filter(Boolean).join(' ')}
                  onClick={() => { if (!isMyTurn) return; setSelectedHandCard(prev => prev === cid ? null : cid); setPendingAction(null) }}
                >
                  <div className="gp-hcard-head wt">Water Silo</div>
                  <div className="gp-hcard-body">
                    <div className="gp-hcard-ability">Junk → +1◈</div>
                    <div className="gp-hcard-ability">Returns to play area</div>
                  </div>
                  <div className="gp-hcard-foot">
                    <span className="gp-hcard-type">SPECIAL</span>
                    <span className="gp-hcard-cost">0◈</span>
                  </div>
                </div>
              )
            }

            const d         = def(cid)
            const t         = d?.type ?? 'unknown'
            const cost      = d ? waterCost(d) : 0
            const junkDesc  = d ? describeJunk(d) : ''
            const abilities = t === 'person' ? (d?.data.activated_abilities as unknown[]) ?? [] : []
            const campAbs   = t === 'camp'   ? (d?.data.ability as unknown[]) ?? [] : []
            const headCls   = t === 'person' ? 'pt' : t === 'event' ? 'et' : 'ct'
            const cantAfford = cost > me.water
            const canDragPlay = isMyTurn && !cantAfford && (t === 'person' || t === 'event')

            return (
              <div
                key={cid}
                className={[
                  'gp-hcard',
                  selectedHandCard === cid ? 'selected'    : '',
                  !isMyTurn              ? 'not-my-turn' : '',
                  cantAfford             ? 'cant-afford'  : '',
                  canDragPlay            ? 'draggable'    : '',
                ].filter(Boolean).join(' ')}
                draggable={canDragPlay}
                onDragStart={canDragPlay ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragHandCard(cid); setPendingAction(null); setSelectedHandCard(null) } : undefined}
                onDragEnd={() => setDragHandCard(null)}
                onClick={() => {
                  if (!isMyTurn) return
                  setSelectedHandCard(prev => prev === cid ? null : cid)
                  setPendingAction(null)
                }}
              >
                <div className={`gp-hcard-head ${headCls}`}>{d?.name ?? cid}</div>
                <div className="gp-hcard-body">
                  {abilities.slice(0, 2).map((ab, i) => (
                    <div key={i} className="gp-hcard-ability">
                      {describePersonAbility(ab as Record<string, unknown>)}
                    </div>
                  ))}
                  {campAbs.slice(0, 2).map((ab, i) => (
                    <div key={i} className="gp-hcard-ability">
                      {describeCampAbility(ab as Record<string, unknown>)}
                    </div>
                  ))}
                  {junkDesc && <div className="gp-hcard-junk"><IcJunk /> {junkDesc}</div>}
                </div>
                <div className="gp-hcard-foot">
                  <span className="gp-hcard-type">{t.toUpperCase()}</span>
                  <span className="gp-hcard-cost">{cost}◈</span>
                </div>
              </div>
            )
          })}
        </div>
        {renderActionPanel()}
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="gp-root">
      <div className="gp-topbar">
        <div className="gp-topbar-left">
          <span className={`gp-turn-badge ${isMyTurn ? 'yours' : 'theirs'}`}>
            {isMyTurn ? 'YOUR TURN' : 'THEIR TURN'}
          </span>
          <span className="gp-turn-info">Turn {gameInfo.turn_number}</span>
        </div>
        <div className="gp-topbar-mid">
          <span className="gp-game-title">RADLANDS</span>
        </div>
        <div className="gp-topbar-right">
          <button className="gp-btn-end" disabled={!isMyTurn} onClick={endTurn}>END TURN</button>
          <button className="gp-btn-resign" onClick={resignGame}>RESIGN</button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#1a0000', borderBottom: '1px solid #ff4444', color: '#ff6666',
          fontSize: 11, padding: '4px 18px', display: 'flex', alignItems: 'center',
          gap: 8, letterSpacing: 1, flexShrink: 0,
        }}>
          {error}
          <button onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <div className="gp-board">
        <div className="gp-game-area">
          {renderPlayerBoard(opp, 'opponent')}

          <div className="gp-divider">
            <div className="gp-divider-line">
              <span className="gp-divider-label">⚔ BATTLE LINE ⚔</span>
            </div>
          </div>

          {renderPlayerBoard(me, 'self')}
        </div>

        {renderHand()}
      </div>
    </div>
  )
}
