import { useState, useEffect, type FormEvent } from 'react'
import type { AuthState } from '../App'
import {
  IconUser, IconUsers, IconSearch, IconPlus,
  IconCheck, IconX, IconInbox, IconZap, IconSend, IconClock,
} from '../components/Icons'
import './FriendsPage.css'

interface Player { user_id: number; username: string; games_played: number; games_won: number }
interface FriendRequest { request_id: number; user_id: number; username: string }
interface Challenge {
  challenge_id: number; username: string; user_id: number
  scheduled_at: string | null; message: string | null; created_at: string
}

type Tab = 'friends' | 'requests' | 'challenges' | 'search'

export function FriendsPage({ auth, onBack, onChallenge }: {
  auth: AuthState; onBack: () => void
  onChallenge: (friend: { userId: number; username: string }) => void
}) {
  const [tab, setTab]                     = useState<Tab>('friends')
  const [friends, setFriends]             = useState<Player[]>([])
  const [incoming, setIncoming]           = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing]           = useState<FriendRequest[]>([])
  const [incomingChal, setIncomingChal]   = useState<Challenge[]>([])
  const [outgoingChal, setOutgoingChal]   = useState<Challenge[]>([])
  const [searchQ, setSearchQ]             = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [msg, setMsg]                     = useState('')

  const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  async function loadFriends() {
    const r = await fetch('/social/friends', { headers })
    if (r.ok) setFriends(await r.json())
  }
  async function loadRequests() {
    const r = await fetch('/social/friends/requests', { headers })
    if (r.ok) {
      const d = await r.json()
      setIncoming(d.incoming); setOutgoing(d.outgoing)
    }
  }
  async function loadChallenges() {
    const r = await fetch('/social/challenges', { headers })
    if (r.ok) {
      const d = await r.json()
      setIncomingChal(d.incoming ?? []); setOutgoingChal(d.outgoing ?? [])
    }
  }

  useEffect(() => { loadFriends(); loadRequests(); loadChallenges() }, [])

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!searchQ.trim()) return
    setSearchLoading(true)
    try {
      const r = await fetch(`/social/players/search?q=${encodeURIComponent(searchQ)}`, { headers })
      if (r.ok) setSearchResults(await r.json())
    } finally { setSearchLoading(false) }
  }

  async function sendRequest(userId: number) {
    const r = await fetch(`/social/friends/request/${userId}`, { method: 'POST', headers })
    const d = await r.json()
    flash(r.ok ? 'Request sent!' : (d.detail ?? 'Error'))
    if (r.ok) loadRequests()
  }

  async function accept(id: number) {
    await fetch(`/social/friends/accept/${id}`, { method: 'POST', headers })
    flash('Ally accepted!'); loadFriends(); loadRequests()
  }

  async function reject(id: number) {
    await fetch(`/social/friends/reject/${id}`, { method: 'POST', headers })
    flash('Request declined.'); loadRequests()
  }

  async function acceptChallenge(id: number) {
    await fetch(`/social/challenges/${id}/accept`, { method: 'POST', headers })
    flash('Challenge accepted!'); loadChallenges()
  }

  async function declineChallenge(id: number) {
    await fetch(`/social/challenges/${id}/decline`, { method: 'POST', headers })
    flash('Challenge declined.'); loadChallenges()
  }

  async function cancelChallenge(id: number) {
    await fetch(`/social/challenges/${id}`, { method: 'DELETE', headers })
    flash('Challenge cancelled.'); loadChallenges()
  }

  const pendingCount    = incoming.length
  const challengeCount  = incomingChal.length

  function fmtDate(dt: string | null) {
    if (!dt) return 'Open challenge'
    return new Date(dt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="fp-root">
      <div className="fp-scanlines" />

      <header className="fp-bar">
        <button className="fp-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK
        </button>
        <div className="fp-bar-center">
          <span className="fp-bar-eyebrow">NETWORK INTERFACE</span>
          <span className="fp-bar-title">ALLIES</span>
        </div>
        <span className="fp-bar-count">{friends.length} ALLIES</span>
      </header>

      {msg && <div className="fp-flash">{msg}</div>}

      {/* Tabs */}
      <div className="fp-tabs">
        {([
          { key: 'friends',    label: 'FRIENDS',    icon: <IconUsers size={14} />,  badge: 0 },
          { key: 'requests',   label: 'REQUESTS',   icon: <IconInbox size={14} />,  badge: pendingCount },
          { key: 'challenges', label: 'CHALLENGES', icon: <IconZap size={14} />,    badge: challengeCount },
          { key: 'search',     label: 'FIND ALLY',  icon: <IconSearch size={14} />, badge: 0 },
        ] as const).map(t => (
          <button
            key={t.key}
            className={`fp-tab ${tab === t.key ? 'fp-tab-active' : ''}`}
            onClick={() => setTab(t.key as Tab)}
          >
            {t.icon}
            {t.label}
            {t.badge > 0 && <span className="fp-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="fp-content">

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div className="fp-list">
            {friends.length === 0 && (
              <div className="fp-empty">
                <IconUsers size={28} color="rgba(255,255,255,.15)" />
                <span>No allies yet. Search for warriors to connect with.</span>
              </div>
            )}
            {friends.map(f => (
              <div key={f.user_id} className="fp-card">
                <div className="fp-card-icon">
                  <IconUser size={18} color="#00e5ff" />
                </div>
                <div className="fp-card-info">
                  <span className="fp-card-name">{f.username}</span>
                  <span className="fp-card-stats">{f.games_won}W · {f.games_played - f.games_won}L</span>
                </div>
                <div className="fp-card-actions">
                  <span className="fp-tag fp-tag-ally">ALLY</span>
                  <button
                    className="fp-btn-challenge"
                    onClick={() => onChallenge({ userId: f.user_id, username: f.username })}
                  >
                    <IconZap size={13} color="#d4ff00" />
                    CHALLENGE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="fp-list">
            {incoming.length > 0 && (
              <>
                <div className="fp-section-label">
                  <IconInbox size={13} color="rgba(255,255,255,.35)" /> INCOMING
                </div>
                {incoming.map(r => (
                  <div key={r.request_id} className="fp-card fp-card-incoming">
                    <div className="fp-card-icon">
                      <IconUser size={18} color="#ff6600" />
                    </div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{r.username}</span>
                      <span className="fp-card-stats">Wants to ally with you</span>
                    </div>
                    <div className="fp-card-actions">
                      <button className="fp-btn-accept" onClick={() => accept(r.request_id)}>
                        <IconCheck size={13} /> ACCEPT
                      </button>
                      <button className="fp-btn-reject" onClick={() => reject(r.request_id)}>
                        <IconX size={13} /> DECLINE
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="fp-section-label">
                  <IconSend size={13} color="rgba(255,255,255,.35)" /> OUTGOING
                </div>
                {outgoing.map(r => (
                  <div key={r.request_id} className="fp-card">
                    <div className="fp-card-icon">
                      <IconUser size={18} color="rgba(255,255,255,.4)" />
                    </div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{r.username}</span>
                      <span className="fp-card-stats">Awaiting response</span>
                    </div>
                    <span className="fp-tag fp-tag-pending">PENDING</span>
                  </div>
                ))}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="fp-empty">
                <IconInbox size={28} color="rgba(255,255,255,.15)" />
                <span>No pending requests.</span>
              </div>
            )}
          </div>
        )}

        {/* CHALLENGES TAB */}
        {tab === 'challenges' && (
          <div className="fp-list">
            {incomingChal.length > 0 && (
              <>
                <div className="fp-section-label">
                  <IconInbox size={13} color="rgba(255,255,255,.35)" /> INCOMING CHALLENGES
                </div>
                {incomingChal.map(c => (
                  <div key={c.challenge_id} className="fp-card fp-card-challenge">
                    <div className="fp-card-icon">
                      <IconZap size={18} color="#d4ff00" />
                    </div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{c.username}</span>
                      <span className="fp-card-stats">
                        <IconClock size={11} color="rgba(255,255,255,.35)" />
                        {fmtDate(c.scheduled_at)}
                      </span>
                      {c.message && <span className="fp-card-msg">"{c.message}"</span>}
                    </div>
                    <div className="fp-card-actions">
                      <button className="fp-btn-accept" onClick={() => acceptChallenge(c.challenge_id)}>
                        <IconCheck size={13} /> ACCEPT
                      </button>
                      <button className="fp-btn-reject" onClick={() => declineChallenge(c.challenge_id)}>
                        <IconX size={13} /> DECLINE
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoingChal.length > 0 && (
              <>
                <div className="fp-section-label">
                  <IconSend size={13} color="rgba(255,255,255,.35)" /> OUTGOING CHALLENGES
                </div>
                {outgoingChal.map(c => (
                  <div key={c.challenge_id} className="fp-card">
                    <div className="fp-card-icon">
                      <IconZap size={18} color="rgba(212,255,0,.4)" />
                    </div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{c.username}</span>
                      <span className="fp-card-stats">
                        <IconClock size={11} color="rgba(255,255,255,.35)" />
                        {fmtDate(c.scheduled_at)}
                      </span>
                      {c.message && <span className="fp-card-msg">"{c.message}"</span>}
                    </div>
                    <div className="fp-card-actions">
                      <button className="fp-btn-reject" onClick={() => cancelChallenge(c.challenge_id)}>
                        <IconX size={13} /> CANCEL
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {incomingChal.length === 0 && outgoingChal.length === 0 && (
              <div className="fp-empty">
                <IconZap size={28} color="rgba(255,255,255,.15)" />
                <span>No pending challenges. Challenge an ally from the Friends tab.</span>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="fp-search-panel">
            <form className="fp-search-form" onSubmit={handleSearch}>
              <div className="fp-search-input-wrap">
                <IconSearch size={16} color="rgba(255,255,255,.3)" className="fp-search-icon" />
                <input
                  className="fp-search-input"
                  type="text"
                  placeholder="Enter warrior callsign…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  minLength={2}
                  required
                />
              </div>
              <button className="fp-search-btn" type="submit" disabled={searchLoading}>
                {searchLoading ? '…' : 'SEARCH'}
              </button>
            </form>
            <div className="fp-list">
              {searchResults.map(p => (
                <div key={p.user_id} className="fp-card">
                  <div className="fp-card-icon">
                    <IconUser size={18} color="#b700ff" />
                  </div>
                  <div className="fp-card-info">
                    <span className="fp-card-name">{p.username}</span>
                    <span className="fp-card-stats">{p.games_won}W · {p.games_played}P</span>
                  </div>
                  <button className="fp-btn-add" onClick={() => sendRequest(p.user_id)}>
                    <IconPlus size={13} /> ADD
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && searchQ && !searchLoading && (
                <div className="fp-empty">
                  <IconSearch size={24} color="rgba(255,255,255,.15)" />
                  <span>No warriors found matching "{searchQ}"</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
