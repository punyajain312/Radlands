import { useState, useEffect, useRef } from 'react'
import { apiUrl } from '../lib/api'
import { toast } from '../components/Toast'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }

  async function apiPost(path: string, opts?: RequestInit) {
    const r = await fetch(apiUrl(path), { method: 'POST', headers, ...opts })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) toast(d.detail ?? 'Something went wrong', 'error')
    return { ok: r.ok, data: d }
  }

  async function loadFriends() {
    const r = await fetch(apiUrl('/social/friends'), { headers })
    if (r.ok) setFriends(await r.json())
  }
  async function loadRequests() {
    const r = await fetch(apiUrl('/social/friends/requests'), { headers })
    if (r.ok) { const d = await r.json(); setIncoming(d.incoming); setOutgoing(d.outgoing) }
  }
  async function loadChallenges() {
    const r = await fetch(apiUrl('/social/challenges'), { headers })
    if (r.ok) { const d = await r.json(); setIncomingChal(d.incoming ?? []); setOutgoingChal(d.outgoing ?? []) }
  }

  useEffect(() => { loadFriends(); loadRequests(); loadChallenges() }, [])

  // ── Auto-search with debounce ──────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQ.trim() || searchQ.trim().length < 2) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await fetch(apiUrl(`/social/players/search?q=${encodeURIComponent(searchQ)}`), { headers })
        if (r.ok) setSearchResults(await r.json())
        else { const d = await r.json(); toast(d.detail ?? 'Search failed', 'error') }
      } finally { setSearchLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQ])

  async function sendRequest(userId: number) {
    const { ok, data } = await apiPost(`/social/friends/request/${userId}`)
    if (ok) { toast('Friend request sent!', 'success'); loadRequests() }
    else if (data.detail) toast(data.detail, 'error')
  }

  async function cancelRequest(requestId: number) {
    const r = await fetch(apiUrl(`/social/friends/request/${requestId}`), { method: 'DELETE', headers })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast('Request cancelled', 'info'); loadRequests() }
    else toast(d.detail ?? 'Failed to cancel', 'error')
  }

  async function accept(id: number) {
    const { ok } = await apiPost(`/social/friends/accept/${id}`)
    if (ok) { toast('Ally accepted!', 'success'); loadFriends(); loadRequests() }
  }

  async function reject(id: number) {
    const { ok } = await apiPost(`/social/friends/reject/${id}`)
    if (ok) { toast('Request declined', 'info'); loadRequests() }
  }

  async function acceptChallenge(id: number) {
    const { ok } = await apiPost(`/social/challenges/${id}/accept`)
    if (ok) { toast('Challenge accepted!', 'success'); loadChallenges() }
  }

  async function declineChallenge(id: number) {
    const { ok } = await apiPost(`/social/challenges/${id}/decline`)
    if (ok) { toast('Challenge declined', 'info'); loadChallenges() }
  }

  async function cancelChallenge(id: number) {
    const r = await fetch(apiUrl(`/social/challenges/${id}`), { method: 'DELETE', headers })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { toast('Challenge cancelled', 'info'); loadChallenges() }
    else toast(d.detail ?? 'Failed to cancel', 'error')
  }

  const pendingCount   = incoming.length
  const challengeCount = incomingChal.length

  const friendIds   = new Set(friends.map(f => f.user_id))
  const outgoingMap = new Map(outgoing.map(r => [r.user_id, r.request_id]))

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
                <div className="fp-card-icon"><IconUser size={18} color="#00e5ff" /></div>
                <div className="fp-card-info">
                  <span className="fp-card-name">{f.username}</span>
                  <span className="fp-card-stats">{f.games_won}W · {f.games_played - f.games_won}L</span>
                </div>
                <div className="fp-card-actions">
                  <span className="fp-tag fp-tag-ally">ALLY</span>
                  <button className="fp-btn-challenge" onClick={() => onChallenge({ userId: f.user_id, username: f.username })}>
                    <IconZap size={13} color="#d4ff00" /> CHALLENGE
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
                <div className="fp-section-label"><IconInbox size={13} color="rgba(255,255,255,.35)" /> INCOMING</div>
                {incoming.map(r => (
                  <div key={r.request_id} className="fp-card fp-card-incoming">
                    <div className="fp-card-icon"><IconUser size={18} color="#ff6600" /></div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{r.username}</span>
                      <span className="fp-card-stats">Wants to ally with you</span>
                    </div>
                    <div className="fp-card-actions">
                      <button className="fp-btn-accept" onClick={() => accept(r.request_id)}><IconCheck size={13} /> ACCEPT</button>
                      <button className="fp-btn-reject" onClick={() => reject(r.request_id)}><IconX size={13} /> DECLINE</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="fp-section-label"><IconSend size={13} color="rgba(255,255,255,.35)" /> OUTGOING</div>
                {outgoing.map(r => (
                  <div key={r.request_id} className="fp-card">
                    <div className="fp-card-icon"><IconUser size={18} color="rgba(255,255,255,.4)" /></div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{r.username}</span>
                      <span className="fp-card-stats">Awaiting response</span>
                    </div>
                    <div className="fp-card-actions">
                      <span className="fp-tag fp-tag-pending">PENDING</span>
                      <button className="fp-btn-reject" onClick={() => cancelRequest(r.request_id)}><IconX size={13} /> CANCEL</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="fp-empty"><IconInbox size={28} color="rgba(255,255,255,.15)" /><span>No pending requests.</span></div>
            )}
          </div>
        )}

        {/* CHALLENGES TAB */}
        {tab === 'challenges' && (
          <div className="fp-list">
            {incomingChal.length > 0 && (
              <>
                <div className="fp-section-label"><IconInbox size={13} color="rgba(255,255,255,.35)" /> INCOMING CHALLENGES</div>
                {incomingChal.map(c => (
                  <div key={c.challenge_id} className="fp-card fp-card-challenge">
                    <div className="fp-card-icon"><IconZap size={18} color="#d4ff00" /></div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{c.username}</span>
                      <span className="fp-card-stats"><IconClock size={11} color="rgba(255,255,255,.35)" />{fmtDate(c.scheduled_at)}</span>
                      {c.message && <span className="fp-card-msg">"{c.message}"</span>}
                    </div>
                    <div className="fp-card-actions">
                      <button className="fp-btn-accept" onClick={() => acceptChallenge(c.challenge_id)}><IconCheck size={13} /> ACCEPT</button>
                      <button className="fp-btn-reject" onClick={() => declineChallenge(c.challenge_id)}><IconX size={13} /> DECLINE</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoingChal.length > 0 && (
              <>
                <div className="fp-section-label"><IconSend size={13} color="rgba(255,255,255,.35)" /> OUTGOING CHALLENGES</div>
                {outgoingChal.map(c => (
                  <div key={c.challenge_id} className="fp-card">
                    <div className="fp-card-icon"><IconZap size={18} color="rgba(212,255,0,.4)" /></div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{c.username}</span>
                      <span className="fp-card-stats"><IconClock size={11} color="rgba(255,255,255,.35)" />{fmtDate(c.scheduled_at)}</span>
                      {c.message && <span className="fp-card-msg">"{c.message}"</span>}
                    </div>
                    <button className="fp-btn-reject" onClick={() => cancelChallenge(c.challenge_id)}><IconX size={13} /> CANCEL</button>
                  </div>
                ))}
              </>
            )}
            {incomingChal.length === 0 && outgoingChal.length === 0 && (
              <div className="fp-empty"><IconZap size={28} color="rgba(255,255,255,.15)" /><span>No pending challenges. Challenge an ally from the Friends tab.</span></div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="fp-search-panel">
            <div className="fp-search-form">
              <div className="fp-search-input-wrap">
                <IconSearch size={16} color="rgba(255,255,255,.3)" className="fp-search-icon" />
                <input
                  className="fp-search-input"
                  type="text"
                  placeholder="Type warrior callsign to search…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  autoFocus
                />
                {searchLoading && <span style={{ color: '#9b6dff', fontSize: 11 }}>…</span>}
              </div>
            </div>
            <div className="fp-list">
              {searchResults.filter(p => p.user_id !== auth.userId).map(p => {
                const isFriend   = friendIds.has(p.user_id)
                const reqId      = outgoingMap.get(p.user_id)
                const isRequested = reqId !== undefined

                return (
                  <div key={p.user_id} className="fp-card">
                    <div className="fp-card-icon"><IconUser size={18} color="#b700ff" /></div>
                    <div className="fp-card-info">
                      <span className="fp-card-name">{p.username}</span>
                      <span className="fp-card-stats">{p.games_won}W · {p.games_played}P</span>
                    </div>
                    <div className="fp-card-actions">
                      {isFriend ? (
                        <span className="fp-tag fp-tag-ally">ALLY</span>
                      ) : isRequested ? (
                        <>
                          <span className="fp-tag fp-tag-pending">REQUESTED</span>
                          <button className="fp-btn-reject" onClick={() => cancelRequest(reqId!)}>
                            <IconX size={13} /> CANCEL
                          </button>
                        </>
                      ) : (
                        <button className="fp-btn-add" onClick={() => sendRequest(p.user_id)}>
                          <IconPlus size={13} /> ADD
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {searchQ.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
                <div className="fp-empty">
                  <IconSearch size={24} color="rgba(255,255,255,.15)" />
                  <span>No warriors found matching "{searchQ}"</span>
                </div>
              )}
              {searchQ.trim().length < 2 && searchQ.trim().length > 0 && (
                <div className="fp-empty"><span>Type at least 2 characters to search</span></div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
