import { useState, useEffect, type FormEvent } from 'react'
import type { AuthState } from '../App'
import './FriendsPage.css'

interface Player { user_id: number; username: string; games_played: number; games_won: number }
interface FriendRequest { request_id: number; user_id: number; username: string }

interface FriendsPageProps {
  auth: AuthState
  onBack: () => void
}

export function FriendsPage({ auth, onBack }: FriendsPageProps) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends')
  const [friends, setFriends] = useState<Player[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function loadFriends() {
    const r = await fetch('/social/friends', { headers })
    if (r.ok) setFriends(await r.json())
  }

  async function loadRequests() {
    const r = await fetch('/social/friends/requests', { headers })
    if (r.ok) {
      const d = await r.json()
      setIncoming(d.incoming)
      setOutgoing(d.outgoing)
    }
  }

  useEffect(() => { loadFriends(); loadRequests() }, [])

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
    flash(r.ok ? 'Friend request sent!' : (d.detail ?? 'Error'))
    if (r.ok) loadRequests()
  }

  async function accept(requestId: number) {
    await fetch(`/social/friends/accept/${requestId}`, { method: 'POST', headers })
    flash('Friend accepted!')
    loadFriends(); loadRequests()
  }

  async function reject(requestId: number) {
    await fetch(`/social/friends/reject/${requestId}`, { method: 'POST', headers })
    flash('Request declined.')
    loadRequests()
  }

  return (
    <div className="fp-root">
      <div className="fp-scanlines" />

      <header className="fp-header">
        <button className="fp-back-btn" onClick={onBack}>← BACK</button>
        <h1 className="fp-title">ALLIES</h1>
        <div className="fp-title-sub">FRIEND NETWORK</div>
      </header>

      {msg && <div className="fp-flash">{msg}</div>}

      <div className="fp-tabs">
        <button className={`fp-tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          FRIENDS ({friends.length})
        </button>
        <button className={`fp-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          REQUESTS {incoming.length > 0 && <span className="fp-badge">{incoming.length}</span>}
        </button>
        <button className={`fp-tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
          FIND ALLY
        </button>
      </div>

      <div className="fp-content">
        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div className="fp-list">
            {friends.length === 0 && (
              <p className="fp-empty">No allies yet. Search for warriors to add.</p>
            )}
            {friends.map(f => (
              <div key={f.user_id} className="fp-player-card">
                <div className="fp-player-icon">⚔</div>
                <div className="fp-player-info">
                  <span className="fp-player-name">{f.username}</span>
                  <span className="fp-player-stats">{f.games_won}W / {f.games_played - f.games_won}L</span>
                </div>
                <div className="fp-player-badge">ALLY</div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="fp-list">
            {incoming.length > 0 && (
              <>
                <div className="fp-section-label">INCOMING</div>
                {incoming.map(r => (
                  <div key={r.request_id} className="fp-player-card">
                    <div className="fp-player-icon">📨</div>
                    <div className="fp-player-info">
                      <span className="fp-player-name">{r.username}</span>
                      <span className="fp-player-stats">wants to ally with you</span>
                    </div>
                    <div className="fp-req-actions">
                      <button className="fp-btn-accept" onClick={() => accept(r.request_id)}>ACCEPT</button>
                      <button className="fp-btn-reject" onClick={() => reject(r.request_id)}>DECLINE</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="fp-section-label">OUTGOING</div>
                {outgoing.map(r => (
                  <div key={r.request_id} className="fp-player-card">
                    <div className="fp-player-icon">📤</div>
                    <div className="fp-player-info">
                      <span className="fp-player-name">{r.username}</span>
                      <span className="fp-player-stats">pending response</span>
                    </div>
                    <div className="fp-player-badge pending">PENDING</div>
                  </div>
                ))}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <p className="fp-empty">No pending requests.</p>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="fp-search-panel">
            <form className="fp-search-form" onSubmit={handleSearch}>
              <input
                className="fp-search-input"
                type="text"
                placeholder="Enter warrior callsign…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                minLength={2}
                required
              />
              <button className="fp-search-btn" type="submit" disabled={searchLoading}>
                {searchLoading ? '…' : 'SEARCH'}
              </button>
            </form>
            <div className="fp-list">
              {searchResults.map(p => (
                <div key={p.user_id} className="fp-player-card">
                  <div className="fp-player-icon">◈</div>
                  <div className="fp-player-info">
                    <span className="fp-player-name">{p.username}</span>
                    <span className="fp-player-stats">{p.games_won}W / {p.games_played}P</span>
                  </div>
                  <button className="fp-btn-add" onClick={() => sendRequest(p.user_id)}>ADD</button>
                </div>
              ))}
              {searchResults.length === 0 && searchQ && !searchLoading && (
                <p className="fp-empty">No warriors found matching "{searchQ}".</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
