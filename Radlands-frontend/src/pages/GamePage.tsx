import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { AuthState } from '../App'
import { apiUrl, wsUrl } from '../lib/api'
import './GamePage.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props { auth: AuthState }

interface CardDef {
  id: string
  name: string
  type: string
  cost: { water?: number } | null
  data: Record<string, unknown>
}

interface CampSlot  { card_id: string; damage: number; destroyed: boolean }
interface PersonSlot { card_id: string; damage: number; ready: boolean }
interface EventSlot  { card_id: string; turns_remaining: number }

interface PlayerState {
  hand: string[]
  water: number
  camps: CampSlot[]
  columns: (PersonSlot | null)[][]
  events: (EventSlot | null)[]
}

interface GameStateData {
  deck: string[]
  discard: string[]
  deck_cycles: number
  turn_context: { people_played_this_turn: number }
  players: Record<string, PlayerState>
}

interface GameInfo {
  game_id: number
  status: string
  current_turn_player_id: number
  turn_number: number
  winner_id: number | null
  player1_id: number
  player2_id: number
  state: GameStateData
}

type TargetSide = 'self' | 'opponent' | 'any'

type PendingAction =
  | { type: 'play_person'; cardId: string }
  | { type: 'play_event'; cardId: string }
  | { type: 'activate_ability'; colIdx: number; posIdx: number; abilityIdx: number; needsTarget: boolean; targetSide: TargetSide; targetType: 'person' | 'camp' }
  | { type: 'activate_camp'; campIdx: number; abilityIdx: number; needsTarget: boolean; targetSide: TargetSide; targetType: 'person' | 'camp' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function waterCost(card: CardDef): number {
  return card.cost?.water ?? 0
}

function effectsNeedTarget(effects: unknown[]): { needs: boolean; side: TargetSide; type: 'person' | 'camp' } {
  const flat: unknown[] = []
  for (const e of effects) {
    const effect = e as Record<string, unknown>
    if (effect.type === 'sequence') {
      flat.push(...((effect.steps as unknown[]) ?? []))
    } else {
      flat.push(effect)
    }
  }
  for (const e of flat) {
    const effect = e as Record<string, unknown>
    const t = effect.target as Record<string, unknown> | undefined
    if (t && typeof t === 'object' && t.scope === 'one') {
      const side: TargetSide = t.side === 'enemy' ? 'opponent' : t.side === 'self' ? 'self' : 'any'
      return { needs: true, side, type: 'person' }
    }
  }
  return { needs: false, side: 'any', type: 'person' }
}

function getCampAbilityTarget(card: CardDef): { needs: boolean; side: TargetSide; type: 'person' | 'camp' } {
  const abilities = (card.data.ability as unknown[]) ?? []
  for (const ab of abilities) {
    const ability = ab as Record<string, unknown>
    const effect = ability.effect as Record<string, unknown> | undefined
    if (!effect) continue
    if (typeof effect.target === 'object' && effect.target !== null) {
      const t = effect.target as Record<string, unknown>
      if (t.scope === 'one') {
        const side: TargetSide = t.side === 'enemy' ? 'opponent' : 'any'
        return { needs: true, side, type: 'person' }
      }
    }
  }
  return { needs: false, side: 'any', type: 'person' }
}

// ── Component ────────────────────────────────────────────────────────────────

export function GamePage({ auth }: Props) {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const gid = Number(gameId)

  const [cards, setCards] = useState<Record<string, CardDef>>({})
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [gameState, setGameState] = useState<GameStateData | null>(null)
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }

  const myId = auth.userId
  const isMyTurn = gameInfo?.current_turn_player_id === myId

  // ── Load cards + game ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [cRes, gRes] = await Promise.all([
          fetch(apiUrl('/cards'), { headers: { Authorization: `Bearer ${auth.token}` } }),
          fetch(apiUrl(`/games/${gid}`), { headers: { Authorization: `Bearer ${auth.token}` } }),
        ])
        if (!cRes.ok || !gRes.ok) throw new Error('Failed to load game')
        const cData: CardDef[] = await cRes.json()
        const gData: GameInfo = await gRes.json()
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

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameInfo) return
    const socket = new WebSocket(wsUrl(`/ws/games/${gid}?token=${auth.token}`))
    ws.current = socket

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'game_state') {
          setGameInfo(prev => prev ? { ...prev,
            status: msg.status,
            current_turn_player_id: msg.current_turn_player_id,
            turn_number: msg.turn_number,
            winner_id: msg.winner_id,
          } : prev)
          setGameState(msg.state)
          setSelectedHandCard(null)
          setPendingAction(null)
        }
      } catch { /* ignore */ }
    }

    socket.onerror = () => setError('WebSocket connection error')
    return () => { socket.close() }
  }, [gameInfo?.game_id])

  // ── API calls ──────────────────────────────────────────────────────────────
  async function post(path: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(apiUrl(path), { method: 'POST', headers, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Action failed')
        return false
      }
      if (data.state) {
        setGameState(data.state)
        setSelectedHandCard(null)
        setPendingAction(null)
      }
      return true
    } catch {
      setError('Network error')
      return false
    }
  }

  async function endTurn() {
    await post(`/games/end-turn/${gid}`, {})
  }

  async function junkCard(cardId: string) {
    setPendingAction(null)
    setSelectedHandCard(null)
    await post(`/games/junk-card/${gid}`, { card_id: cardId })
  }

  async function playPerson(cardId: string, colIdx: number) {
    setPendingAction(null)
    setSelectedHandCard(null)
    await post(`/games/play-person/${gid}`, { card_id: cardId, column_index: colIdx })
  }

  async function playEvent(cardId: string, slot: number) {
    setPendingAction(null)
    setSelectedHandCard(null)
    await post(`/games/play-event/${gid}`, { card_id: cardId, queue_slot: slot })
  }

  async function activateAbility(
    colIdx: number, posIdx: number, abilityIdx: number,
    target?: { type: 'person' | 'camp'; side: 'self' | 'opponent'; col?: number; pos?: number; campIdx?: number }
  ) {
    const body: Record<string, unknown> = { column_index: colIdx, position_index: posIdx, ability_index: abilityIdx }
    if (target) {
      body.target_type = target.type
      body.target_side = target.side
      if (target.col !== undefined) body.target_column = target.col
      if (target.pos !== undefined) body.target_position = target.pos
      if (target.campIdx !== undefined) body.target_camp_index = target.campIdx
    }
    setPendingAction(null)
    setSelectedHandCard(null)
    await post(`/games/activate-ability/${gid}`, body)
  }

  async function activateCamp(
    campIdx: number, abilityIdx: number,
    target?: { type: 'person' | 'camp'; side: 'self' | 'opponent'; col?: number; pos?: number; campIdx?: number }
  ) {
    const body: Record<string, unknown> = { camp_index: campIdx, ability_index: abilityIdx }
    if (target) {
      body.target_type = target.type
      body.target_side = target.side
      if (target.col !== undefined) body.target_column = target.col
      if (target.pos !== undefined) body.target_position = target.pos
      if (target.campIdx !== undefined) body.target_camp_index = target.campIdx
    }
    setPendingAction(null)
    setSelectedHandCard(null)
    await post(`/games/activate-camp/${gid}`, body)
  }

  // ── Targeting clicks ───────────────────────────────────────────────────────
  function handleTargetPerson(side: 'self' | 'opponent', colIdx: number, posIdx: number) {
    if (!pendingAction) return
    if (pendingAction.type === 'activate_ability') {
      activateAbility(pendingAction.colIdx, pendingAction.posIdx, pendingAction.abilityIdx,
        { type: 'person', side, col: colIdx, pos: posIdx })
    } else if (pendingAction.type === 'activate_camp') {
      activateCamp(pendingAction.campIdx, pendingAction.abilityIdx,
        { type: 'person', side, col: colIdx, pos: posIdx })
    }
  }

  function handleTargetCamp(side: 'self' | 'opponent', campIdx: number) {
    if (!pendingAction) return
    if (pendingAction.type === 'activate_ability') {
      activateAbility(pendingAction.colIdx, pendingAction.posIdx, pendingAction.abilityIdx,
        { type: 'camp', side, campIdx })
    } else if (pendingAction.type === 'activate_camp') {
      activateCamp(pendingAction.campIdx, pendingAction.abilityIdx,
        { type: 'camp', side, campIdx })
    }
  }

  const cancel = useCallback(() => {
    setPendingAction(null)
    setSelectedHandCard(null)
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────────
  if (!gameInfo || !gameState) {
    return <div className="gp-root" style={{ padding: 40, color: '#9b6dff', letterSpacing: 2 }}>LOADING GAME...</div>
  }

  const oppId = gameInfo.player1_id === myId ? gameInfo.player2_id : gameInfo.player1_id
  const me = gameState.players[String(myId)]
  const opp = gameState.players[String(oppId)]
  const isTargeting = pendingAction !== null && (
    pendingAction.type === 'activate_ability' || pendingAction.type === 'activate_camp'
  ) && (pendingAction.needsTarget)
  const targetInfo = isTargeting && pendingAction && (pendingAction.type === 'activate_ability' || pendingAction.type === 'activate_camp')
    ? { side: pendingAction.targetSide, type: pendingAction.targetType }
    : null

  function isPersonTarget(side: 'self' | 'opponent', _col: number, _pos: number): boolean {
    if (!targetInfo) return false
    return (targetInfo.side === side || targetInfo.side === 'any') && targetInfo.type === 'person'
  }

  function isCampTarget(side: 'self' | 'opponent'): boolean {
    if (!targetInfo) return false
    return (targetInfo.side === side || targetInfo.side === 'any') && targetInfo.type === 'camp'
  }

  const card = (id: string): CardDef | undefined => cards[id]

  // ── Game over overlay ──────────────────────────────────────────────────────
  if (gameInfo.status === 'finished') {
    const isDraw = gameInfo.winner_id === null
    const iWon = gameInfo.winner_id === myId
    return (
      <div className="gp-root">
        <div className="gp-overlay">
          <div className="gp-overlay-box">
            <div className={`gp-overlay-title ${isDraw ? 'draw' : iWon ? 'win' : 'lose'}`}>
              {isDraw ? 'DRAW' : iWon ? 'VICTORY' : 'DEFEAT'}
            </div>
            <div className="gp-overlay-sub">
              {isDraw ? 'The wasteland claims you both.' : iWon ? 'You razed their camps.' : 'Your camps lie in ruin.'}
            </div>
            <button className="gp-overlay-btn" onClick={() => navigate('/play')}>BACK TO LOBBY</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderDamagePips(damage: number, max = 2) {
    return (
      <div className="gp-damage-row">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`gp-damage-pip ${i < damage ? '' : 'empty'}`} />
        ))}
      </div>
    )
  }

  function renderWater(water: number, max = 3) {
    return (
      <div className="gp-water-dots">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`gp-water-dot ${i < water ? '' : 'empty'}`} />
        ))}
      </div>
    )
  }

  function renderPersonCard(
    slot: PersonSlot,
    side: 'self' | 'opponent',
    colIdx: number,
    posIdx: number
  ) {
    const def = card(slot.card_id)
    const tapped = !slot.ready
    const isTarget = isPersonTarget(side, colIdx, posIdx)
    const isSelected = pendingAction?.type === 'activate_ability' &&
      side === 'self' && pendingAction.colIdx === colIdx && pendingAction.posIdx === posIdx

    function handleClick() {
      if (isTargeting && isTarget) {
        handleTargetPerson(side, colIdx, posIdx)
        return
      }
      if (!isMyTurn || side !== 'self') return
      if (!def) return

      const abilities = (def.data.activated_abilities as unknown[]) ?? []
      if (abilities.length === 0) return

      const ab = abilities[0] as Record<string, unknown>
      const effects = (ab.effects as unknown[]) ?? []
      const { needs, side: tSide, type: tType } = effectsNeedTarget(effects)

      setPendingAction({
        type: 'activate_ability',
        colIdx, posIdx, abilityIdx: 0,
        needsTarget: needs,
        targetSide: tSide,
        targetType: tType,
      })
      setSelectedHandCard(null)

      if (!needs) {
        activateAbility(colIdx, posIdx, 0)
      }
    }

    const classes = [
      'gp-card',
      tapped ? 'tapped' : '',
      isTarget ? 'target-highlight' : '',
      isSelected ? 'selected' : '',
    ].filter(Boolean).join(' ')

    return (
      <div key={`${colIdx}-${posIdx}`} className={classes} onClick={handleClick}>
        <div className="gp-card-name">{def?.name ?? slot.card_id}</div>
        <div className="gp-card-type">PERSON</div>
        {renderDamagePips(slot.damage)}
      </div>
    )
  }

  function renderCampCard(camp: CampSlot, side: 'self' | 'opponent', campIdx: number) {
    const def = card(camp.card_id)
    const isTarget = isCampTarget(side)
    const abilities = (def?.data?.ability as unknown[]) ?? []
    const hasAbility = abilities.length > 0

    function handleClick() {
      if (isTargeting && isTarget) {
        handleTargetCamp(side, campIdx)
        return
      }
      if (!isMyTurn || side !== 'self' || camp.destroyed) return
      if (!def || !hasAbility) return

      const { needs, side: tSide, type: tType } = getCampAbilityTarget(def)
      const ability = abilities[0] as Record<string, unknown>
      const cost = (ability.cost as number) ?? 0

      if (me.water < cost) {
        setError(`Need ${cost} water (have ${me.water})`)
        return
      }

      setPendingAction({
        type: 'activate_camp',
        campIdx, abilityIdx: 0,
        needsTarget: needs,
        targetSide: tSide,
        targetType: tType,
      })
      setSelectedHandCard(null)

      if (!needs) {
        activateCamp(campIdx, 0)
      }
    }

    const classes = [
      'gp-card camp-card',
      camp.destroyed ? 'destroyed' : '',
      isTarget ? 'target-highlight' : '',
    ].filter(Boolean).join(' ')

    return (
      <div key={campIdx} className={classes} onClick={handleClick}>
        <div className="gp-card-name">{def?.name ?? camp.card_id}</div>
        <div className="gp-card-type">CAMP</div>
        {renderDamagePips(camp.damage)}
        {hasAbility && !camp.destroyed && (
          <div style={{ fontSize: 8, color: '#9b6dff', marginTop: 2 }}>
            ABILITY: {(abilities[0] as Record<string, unknown>).cost as number ?? 0}💧
          </div>
        )}
      </div>
    )
  }

  function renderColumn(
    colIdx: number,
    camps: CampSlot[],
    columns: (PersonSlot | null)[][],
    side: 'self' | 'opponent'
  ) {
    const camp = camps[colIdx]
    const col = columns[colIdx] ?? []
    const persons: (PersonSlot | null)[] = [col[0] ?? null, col[1] ?? null]

    const isPlayTarget = pendingAction?.type === 'play_person'

    function handleEmptySlotClick(_posIdx: number) {
      if (!isPlayTarget || side !== 'self') return
      if (col.length >= 2) return
      playPerson((pendingAction as { type: 'play_person'; cardId: string }).cardId, colIdx)
    }

    return (
      <div key={colIdx} className="gp-column">
        <div className="gp-column-label">COL {colIdx}</div>
        {side === 'opponent' ? (
          <>
            {renderCampCard(camp, 'opponent', colIdx)}
            {persons.map((p, pi) =>
              p
                ? renderPersonCard(p, 'opponent', colIdx, pi)
                : <div key={pi} className="gp-card empty-slot" />
            )}
          </>
        ) : (
          <>
            {persons.map((p, pi) =>
              p
                ? renderPersonCard(p, 'self', colIdx, pi)
                : (
                  <div
                    key={pi}
                    className={`gp-card empty-slot ${isPlayTarget && col.length < 2 ? 'drop-target' : ''}`}
                    onClick={() => handleEmptySlotClick(pi)}
                  />
                )
            )}
            {renderCampCard(camp, 'self', colIdx)}
          </>
        )}
      </div>
    )
  }

  function renderEventSlot(slot: EventSlot | null, idx: number, side: 'self' | 'opponent') {
    const isPlayTarget = pendingAction?.type === 'play_event' && side === 'self'

    function handleClick() {
      if (isPlayTarget && !slot) {
        playEvent((pendingAction as { type: 'play_event'; cardId: string }).cardId, idx)
      }
    }

    if (slot) {
      const def = card(slot.card_id)
      return (
        <div key={idx} className="gp-event-slot filled">
          <div className="gp-event-name">{def?.name ?? slot.card_id}</div>
          <div className="gp-event-fuse">{slot.turns_remaining}T</div>
        </div>
      )
    }

    return (
      <div
        key={idx}
        className={`gp-event-slot ${isPlayTarget ? 'clickable' : ''}`}
        onClick={handleClick}
      >
        {isPlayTarget ? 'PLAY HERE' : 'EMPTY'}
      </div>
    )
  }

  // ── Hand card action panel ─────────────────────────────────────────────────
  function renderHandCardPanel() {
    if (!selectedHandCard) return null
    const def = card(selectedHandCard)
    if (!def) return null

    const cost = waterCost(def)
    const canAfford = me.water >= cost
    const isPerson = def.type === 'person'
    const isEvent = def.type === 'event'

    return (
      <div className="gp-action-panel">
        <div className="gp-action-title">SELECTED</div>
        <div className="gp-action-card-name">{def.name}</div>
        <div style={{ fontSize: 10, color: '#6b4a9b' }}>
          {isPerson ? 'PERSON' : isEvent ? 'EVENT' : def.type.toUpperCase()} · Cost: {cost}💧
        </div>
        <div className="gp-action-btns">
          {isPerson && isMyTurn && canAfford && (
            <button
              className="gp-action-btn primary"
              onClick={() => {
                setPendingAction({ type: 'play_person', cardId: selectedHandCard })
              }}
            >
              DEPLOY TO COLUMN ▸
            </button>
          )}
          {isEvent && isMyTurn && canAfford && (
            <button
              className="gp-action-btn primary"
              onClick={() => {
                setPendingAction({ type: 'play_event', cardId: selectedHandCard })
              }}
            >
              QUEUE EVENT ▸
            </button>
          )}
          <button
            className="gp-action-btn"
            onClick={() => junkCard(selectedHandCard)}
          >
            JUNK FOR EFFECT
          </button>
          <button className="gp-action-btn cancel" onClick={cancel}>CANCEL</button>
        </div>
        {!canAfford && isMyTurn && (
          <div style={{ fontSize: 10, color: '#ff4444' }}>Not enough water (need {cost})</div>
        )}
      </div>
    )
  }

  function renderTargetingHint() {
    if (!isTargeting) return null
    const action = pendingAction as { targetType: string; targetSide: string }
    return (
      <div className="gp-action-panel">
        <div className="gp-targeting-hint">
          ◉ SELECT A TARGET — click a highlighted {action.targetType.toUpperCase()}
        </div>
        <div className="gp-action-btns">
          <button className="gp-action-btn cancel" onClick={cancel}>CANCEL</button>
        </div>
      </div>
    )
  }

  function renderColumnSelection() {
    if (pendingAction?.type !== 'play_person' && pendingAction?.type !== 'play_event') return null
    const hint = pendingAction.type === 'play_person'
      ? '▸ Click an empty slot in any column to deploy'
      : '▸ Click an empty event slot to queue'
    return (
      <div className="gp-action-panel">
        <div className="gp-targeting-hint">{hint}</div>
        <div className="gp-action-btns">
          <button className="gp-action-btn cancel" onClick={cancel}>CANCEL</button>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="gp-root">
      {/* Top bar */}
      <div className="gp-topbar">
        <div className="gp-topbar-left">
          <span className={`gp-turn-badge ${isMyTurn ? 'yours' : 'theirs'}`}>
            {isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN'}
          </span>
          <span className="gp-turn-num">Turn {gameInfo.turn_number}</span>
          <span className="gp-deck-info">Deck: {gameState.deck.length} · Discard: {gameState.discard.length}</span>
        </div>
        <div className="gp-topbar-right">
          <button
            className="gp-btn-end"
            disabled={!isMyTurn}
            onClick={endTurn}
          >
            END TURN
          </button>
          <button className="gp-btn-resign" onClick={() => navigate('/play')}>RESIGN</button>
        </div>
      </div>

      {error && (
        <div className="gp-error-bar">
          {error}
          <button className="gp-error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Board */}
      <div className="gp-board">
        {/* ── Opponent area ── */}
        <div className="gp-player-area">
          <div className="gp-player-header">
            <span className="gp-player-name">OPPONENT #{oppId}</span>
            <div className="gp-water-display">
              <span className="gp-water-icon">💧</span>
              {renderWater(opp?.water ?? 0, 3)}
              <span>{opp?.water ?? 0}</span>
            </div>
          </div>

          {/* Opponent events */}
          <div className="gp-events-row">
            <span className="gp-events-label">EVENTS</span>
            {(opp?.events ?? [null, null, null]).map((slot, i) => renderEventSlot(slot, i, 'opponent'))}
          </div>

          {/* Opponent columns */}
          <div className="gp-columns">
            {[0, 1, 2].map(i => renderColumn(i, opp?.camps ?? [], opp?.columns ?? [[], [], []], 'opponent'))}
          </div>
        </div>

        <hr className="gp-divider" />

        {/* ── My area ── */}
        <div className="gp-player-area">
          {/* My columns */}
          <div className="gp-columns">
            {[0, 1, 2].map(i => renderColumn(i, me?.camps ?? [], me?.columns ?? [[], [], []], 'self'))}
          </div>

          {/* My events */}
          <div className="gp-events-row">
            <span className="gp-events-label">MY EVENTS</span>
            {(me?.events ?? [null, null, null]).map((slot, i) => renderEventSlot(slot, i, 'self'))}
          </div>

          <div className="gp-player-header">
            <span className="gp-player-name">YOU ({auth.username})</span>
            <div className="gp-water-display">
              <span className="gp-water-icon">💧</span>
              {renderWater(me?.water ?? 0, 3)}
              <span>{me?.water ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ── Hand & actions ── */}
        <div className="gp-hand-section">
          <div className="gp-hand-label">HAND ({me?.hand.length ?? 0} cards)</div>
          <div className="gp-hand-cards">
            {(me?.hand ?? []).map(cid => {
              const def = card(cid)
              return (
                <div
                  key={cid}
                  className={`gp-hand-card ${selectedHandCard === cid ? 'selected' : ''}`}
                  onClick={() => {
                    if (!isMyTurn) return
                    setSelectedHandCard(prev => prev === cid ? null : cid)
                    setPendingAction(null)
                  }}
                >
                  <div className="gp-hand-card-name">{def?.name ?? cid}</div>
                  <div className="gp-hand-card-meta">{def?.type?.toUpperCase() ?? '?'}</div>
                  <div className="gp-hand-card-cost">{waterCost(def ?? { id: '', name: '', type: '', cost: null, data: {} })}💧</div>
                </div>
              )
            })}
          </div>

          {isTargeting ? renderTargetingHint() : null}
          {!isTargeting && selectedHandCard ? renderHandCardPanel() : null}
          {!isTargeting && (pendingAction?.type === 'play_person' || pendingAction?.type === 'play_event')
            ? renderColumnSelection() : null}
        </div>
      </div>
    </div>
  )
}
