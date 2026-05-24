import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/api'
import type { AuthState } from '../App'
import {
  IconTrophy, IconTarget, IconFlame, IconBarChart,
  IconShield, IconStar, IconUser, IconAward, IconX,
} from '../components/Icons'
import { RANKS, getRankFromRating, rankProgress } from '../constants/ranks'
import { toast } from '../components/Toast'
import './ProfilePage.css'

interface Stats {
  username: string
  games_played: number; games_won: number; games_lost: number
  win_rate: number; rating: number
  favorite_card: { name: string; type: string; count: number } | null
  least_used_card: { name: string; type: string; count: number } | null
  card_play_counts: Record<string, number>
}

interface LeaderEntry {
  rank: number; username: string; games_won: number; games_played: number; rating: number
}

const TYPE_FLAVOR: Record<string, string> = {
  person:  'Combat operative — elite field unit',
  event:   'Tactical event card — timed strike',
  camp:    'Fortified stronghold — defensive structure',
  unknown: 'Field-ready operative awaiting deployment',
}

function starCount(tier: number) { return Math.min(5, Math.max(1, Math.floor((tier / 10) * 5 + 1))) }

function IconSwords({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
      <polyline points="9.5 6.5 21 18 21 21 18 21 6.5 9.5" />
      <line x1="11" y1="5" x2="5" y2="11" />
      <line x1="8" y1="8" x2="4" y2="4" />
      <line x1="5" y1="5" x2="3" y2="3" />
    </svg>
  )
}

function IconSword({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  )
}

/* ─────────────────────────────── RANK MODAL ─────────────────────────────── */
function RankModal({ currentRating, onClose }: { currentRating: number; onClose: () => void }) {
  const currentRank = getRankFromRating(currentRating)
  return (
    <div className="pp-modal-overlay" onClick={onClose}>
      <div className="pp-modal" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-head">
          <div>
            <div className="pp-modal-eyebrow">RADLANDS ARENA</div>
            <div className="pp-modal-title">RANK SYSTEM</div>
          </div>
          <button className="pp-modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>
        <div className="pp-modal-sub">ELO-based rating · ~+16–30 on win · ~-2–16 on loss · starts at 0</div>

        <div className="pp-rank-list">
          {[...RANKS].reverse().map(rank => {
            const isCurrentRank = rank.tier === currentRank.tier
            const isUnlocked = currentRating >= rank.min
            const displayMax = rank.max === Infinity ? '∞' : rank.max.toString()
            const pct = isCurrentRank ? rankProgress(currentRating) : isUnlocked ? 100 : 0
            return (
              <div
                key={rank.tier}
                className={`pp-rank-row ${isCurrentRank ? 'pp-rank-row-active' : ''} ${!isUnlocked ? 'pp-rank-row-locked' : ''}`}
              >
                <span className="pp-rank-tier">{rank.tier}</span>
                <div className="pp-rank-name" style={{ color: isUnlocked ? rank.color : 'rgba(255,255,255,.2)' }}>
                  {rank.name}
                </div>
                <div className="pp-rank-range">
                  {rank.min} — {displayMax}
                </div>
                <div className="pp-rank-bar-track">
                  <div
                    className="pp-rank-bar-fill"
                    style={{ width: `${pct}%`, background: rank.color, opacity: isUnlocked ? 1 : 0.15 }}
                  />
                </div>
                {isCurrentRank && (
                  <span className="pp-rank-current-tag">YOU</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── SETTINGS PANEL ─────────────────────────── */
function SettingsPanel({ auth, onUsernameChange }: { auth: AuthState; onUsernameChange: (u: string) => void }) {
  const [canChange, setCanChange]       = useState(true)
  const [daysLeft, setDaysLeft]         = useState(0)
  const [newUsername, setNewUsername]   = useState('')
  const [unameLoading, setUnameLoading] = useState(false)

  const [curPass, setCurPass]         = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confPass, setConfPass]       = useState('')
  const [passLoading, setPassLoading] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/auth/me/username-change-status'), {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setCanChange(d.can_change); setDaysLeft(d.days_until_change) }
      })
  }, [auth.token])

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim()) return
    setUnameLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/me/username'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ new_username: newUsername.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data.detail
        toast(typeof detail === 'string' ? detail : 'Username change failed', 'error')
      } else {
        toast('Callsign updated!', 'success')
        setNewUsername('')
        setCanChange(false)
        setDaysLeft(7)
        onUsernameChange(data.username)
      }
    } catch { toast('Cannot reach server', 'error') }
    finally { setUnameLoading(false) }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confPass) { toast('New passwords do not match', 'error'); return }
    setPassLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/me/password'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ current_password: curPass, new_password: newPass }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data.detail
        toast(typeof detail === 'string' ? detail : 'Password change failed', 'error')
      } else {
        toast('Security protocol updated!', 'success')
        setCurPass(''); setNewPass(''); setConfPass('')
      }
    } catch { toast('Cannot reach server', 'error') }
    finally { setPassLoading(false) }
  }

  return (
    <div className="pp-settings">
      <div className="pp-section-head">
        <span className="pp-sec-title">OPERATIVE SETTINGS</span>
        <span className="pp-sec-sub">Manage credentials</span>
      </div>

      {/* Username change */}
      <div className="pp-settings-block">
        <div className="pp-settings-block-title">CHANGE CALLSIGN</div>
        {!canChange ? (
          <div className="pp-settings-locked">
            Callsign locked — available in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
          </div>
        ) : (
          <form className="pp-settings-form" onSubmit={handleUsernameChange}>
            <input
              className="pp-settings-input"
              type="text"
              placeholder="New callsign"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              minLength={3}
              required
            />
            <button className="pp-settings-btn" type="submit" disabled={unameLoading}>
              {unameLoading ? 'UPDATING…' : 'UPDATE'}
            </button>
          </form>
        )}
        <div className="pp-settings-hint">Callsign can only be changed once per week</div>
      </div>

      {/* Password change */}
      <div className="pp-settings-block">
        <div className="pp-settings-block-title">CHANGE SECURITY PROTOCOL</div>
        <form className="pp-settings-form pp-settings-form-col" onSubmit={handlePasswordChange}>
          <input
            className="pp-settings-input"
            type="password"
            placeholder="Current protocol"
            value={curPass}
            onChange={e => setCurPass(e.target.value)}
            required
          />
          <input
            className="pp-settings-input"
            type="password"
            placeholder="New protocol (8+ chars, UPPER, number)"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            minLength={8}
            required
          />
          <input
            className="pp-settings-input"
            type="password"
            placeholder="Confirm new protocol"
            value={confPass}
            onChange={e => setConfPass(e.target.value)}
            required
          />
          <button className="pp-settings-btn" type="submit" disabled={passLoading}>
            {passLoading ? 'UPDATING…' : 'UPDATE PROTOCOL'}
          </button>
        </form>
      </div>
    </div>
  )
}


/* ─────────────────────────────── MAIN PAGE ─────────────────────────────── */
export function ProfilePage({ auth, onBack }: { auth: AuthState; onBack: () => void }) {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [leaderboard, setLboard]  = useState<LeaderEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [showRanks, setShowRanks] = useState(false)
  const [currentUsername, setCurrentUsername] = useState(auth.username)

  useEffect(() => {
    const h = { Authorization: `Bearer ${auth.token}` }
    Promise.all([
      fetch(apiUrl('/social/me/stats'),   { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(apiUrl('/social/leaderboard'),{ headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([s, l]) => {
      if (s) setStats(s)
      setLboard(l ?? [])
    }).finally(() => setLoading(false))
  }, [auth.token])

  const rating = stats?.rating ?? 0
  const rank   = getRankFromRating(rating)
  const pct    = rankProgress(rating)
  const stars  = starCount(rank.tier)

  const P = stats?.games_played ?? 0
  const W = stats?.games_won    ?? 0
  const L = stats?.games_lost   ?? 0
  const R = stats?.win_rate     ?? 0

  const topCards    = stats
    ? Object.entries(stats.card_play_counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    : []
  const featuredCard = stats?.favorite_card ?? null

  return (
    <div className="pp-root">
      <div className="pp-scanlines" />

      {showRanks && (
        <RankModal currentRating={rating} onClose={() => setShowRanks(false)} />
      )}

      <header className="pp-bar">
        <button className="pp-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK
        </button>
        <div className="pp-bar-center">
          <span className="pp-bar-eyebrow">OPERATIVE DOSSIER</span>
          <span className="pp-bar-title">COMBAT PROFILE</span>
        </div>
        <span className="pp-bar-tag">{currentUsername.toUpperCase()}</span>
      </header>

      <div className="pp-body">

        {/* LEFT — YOUR ARSENAL */}
        <div className="pp-left">
          <div className="pp-section-head">
            <span className="pp-sec-title">YOUR ARSENAL</span>
            <span className="pp-sec-sub">Most deployed operatives</span>
          </div>

          {loading ? <div className="pp-spinner" /> : (
            <>
              {/* Featured operative card */}
              <div className="pp-featured-card">
                <div className="pp-fc-left">
                  <div className="pp-fc-icon">
                    <IconSwords size={28} color="#ff0080" />
                  </div>
                  <div className="pp-fc-info">
                    <span className="pp-fc-name">{featuredCard?.name ?? auth.username.toUpperCase()}</span>
                    <span className="pp-fc-class">{(featuredCard?.type ?? 'OPERATIVE').toUpperCase()}</span>
                    <span className="pp-fc-flavor">{TYPE_FLAVOR[featuredCard?.type ?? 'unknown']}</span>
                    <div className="pp-fc-power-row">
                      <span className="pp-fc-power-label">POWER LEVEL</span>
                      <span className="pp-fc-power-val">{Math.min(99, Math.round(R))}</span>
                    </div>
                    <div className="pp-fc-power-track">
                      <div className="pp-fc-power-fill" style={{ width: `${Math.min(99, Math.round(R))}%` }} />
                    </div>
                  </div>
                </div>
                <div className="pp-fc-right">
                  <div className="pp-fc-stars">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <IconStar key={idx} size={14} color={idx < stars ? '#ffd700' : 'rgba(255,255,255,.12)'} />
                    ))}
                  </div>
                  <div className="pp-fc-badge">TOP OPERATIVE</div>
                </div>
              </div>

              {/* Sub-cards row */}
              <div className="pp-sub-cards">
                {topCards.length === 0 ? (
                  <div className="pp-no-cards">
                    <IconUser size={20} color="rgba(255,255,255,.2)" />
                    <span>No operatives deployed yet</span>
                  </div>
                ) : (
                  topCards.map(([id, count]) => {
                    const maxCount = topCards[0][1]
                    const p = Math.round((count / maxCount) * 99)
                    return (
                      <div key={id} className="pp-sub-card">
                        <div className="pp-sub-icon"><IconSword size={16} color="#ff0080" /></div>
                        <span className="pp-sub-name">OP-{id.toString().padStart(3, '0')}</span>
                        <span className="pp-sub-pwr">{p} PWR</span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* ── Rank badge (clickable) ── */}
              <div className="pp-rank-section">
                <div className="pp-sec-head" style={{ marginBottom: 12 }}>
                  <span className="pp-sec-title">CURRENT RANK</span>
                  <button className="pp-view-all-ranks" onClick={() => setShowRanks(true)}>
                    <IconAward size={13} color="#b700ff" /> VIEW ALL RANKS
                  </button>
                </div>
                <button className="pp-rank-badge" onClick={() => setShowRanks(true)}>
                  <div className="pp-rb-left">
                    <div className="pp-rb-icon" style={{ borderColor: rank.color, background: `${rank.color}14` }}>
                      <IconShield size={22} color={rank.color} />
                    </div>
                    <div className="pp-rb-info">
                      <span className="pp-rb-name" style={{ color: rank.color, textShadow: `0 0 12px ${rank.color}80` }}>
                        {rank.name}
                      </span>
                      <span className="pp-rb-rating">{rating} PTS</span>
                      <span className="pp-rb-desc">{rank.description}</span>
                    </div>
                  </div>
                  <div className="pp-rb-right">
                    <div className="pp-rb-pct" style={{ color: rank.color }}>{pct}%</div>
                    <div className="pp-rb-track">
                      <div className="pp-rb-fill" style={{ width: `${pct}%`, background: rank.color }} />
                    </div>
                    <div className="pp-rb-next">
                      {rank.max !== Infinity
                        ? `${rank.max - rating} to next`
                        : 'MAX RANK'}
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — BATTLE STATISTICS */}
        <div className="pp-right">
          <div className="pp-section-head">
            <span className="pp-sec-title">BATTLE STATISTICS</span>
            <span className="pp-sec-sub">Tier {rank.tier} · {rank.name}</span>
          </div>

          {loading ? <div className="pp-spinner" /> : (
            <>
              <div className="pp-stat-list">
                {([
                  { label: 'WIN RATE',      sub: 'Overall performance',  val: `${R}%`, color: '#ff0080', Icon: IconBarChart },
                  { label: 'RATING',        sub: 'Arena score',          val: rating,   color: rank.color, Icon: IconAward },
                  { label: 'TOTAL BATTLES', sub: 'Games completed',      val: P,        color: '#00e5ff', Icon: IconTarget },
                  { label: 'VICTORIES',     sub: 'Confirmed wins',        val: W,        color: '#d4ff00', Icon: IconTrophy },
                  { label: 'DEFEATS',       sub: 'Fallen in battle',     val: L,        color: '#ff6600', Icon: IconFlame },
                ] as const).map(s => (
                  <div key={s.label} className="pp-stat-row">
                    <div className="pp-stat-icon-wrap" style={{ borderColor: `${s.color}55`, background: `${s.color}12` }}>
                      <s.Icon size={18} color={s.color} />
                    </div>
                    <div className="pp-stat-info">
                      <span className="pp-stat-label">{s.label}</span>
                      <span className="pp-stat-sub">{s.sub}</span>
                    </div>
                    <span className="pp-stat-val" style={{ color: s.color, textShadow: `0 0 12px ${s.color}` }}>
                      {s.val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pp-wr-section">
                <div className="pp-wr-labels">
                  <span style={{ color: '#d4ff00' }}>WINS {W}</span>
                  <span style={{ color: '#ff0080' }}>LOSSES {L}</span>
                </div>
                <div className="pp-wr-track">
                  <div className="pp-wr-fill-win"  style={{ flex: W }} />
                  <div className="pp-wr-fill-loss" style={{ flex: Math.max(L, 0.001) }} />
                </div>
              </div>

              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="pp-leaderboard">
                  <div className="pp-lb-title">
                    <IconShield size={14} color="#b700ff" /> ARENA RANKINGS
                  </div>
                  {leaderboard.map(entry => {
                    const entryRank = getRankFromRating(entry.rating)
                    const isMe = entry.username === auth.username
                    return (
                      <div key={entry.rank} className={`pp-lb-row ${isMe ? 'pp-lb-me' : ''}`}>
                        <span className="pp-lb-pos">{entry.rank}</span>
                        <span className="pp-lb-name">{entry.username.toUpperCase()}</span>
                        <span className="pp-lb-rank-name" style={{ color: entryRank.color }}>
                          {entryRank.name}
                        </span>
                        <div className="pp-lb-bar-track">
                          <div
                            className="pp-lb-bar-fill"
                            style={{
                              width: `${leaderboard[0].games_won > 0 ? (entry.games_won / leaderboard[0].games_won) * 100 : 0}%`,
                              background: isMe ? '#ff0080' : '#b700ff',
                            }}
                          />
                        </div>
                        <span className="pp-lb-wins">{entry.games_won}W</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {P === 0 && (
                <div className="pp-empty">
                  <IconSwords size={32} color="rgba(255,0,128,.2)" />
                  <span>No battles recorded yet</span>
                  <span className="pp-empty-sub">Enter the wasteland to build your legend</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* SETTINGS PANEL */}
        <SettingsPanel auth={auth} onUsernameChange={u => setCurrentUsername(u)} />
      </div>
    </div>
  )
}
