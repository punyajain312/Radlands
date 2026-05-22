import { useState, useEffect } from 'react'
import type { AuthState } from '../App'
import './ProfilePage.css'

interface Stats {
  username: string
  games_played: number
  games_won: number
  games_lost: number
  win_rate: number
  favorite_card: { name: string; type: string; count: number } | null
  least_used_card: { name: string; type: string; count: number } | null
  card_play_counts: Record<string, number>
}

interface ProfilePageProps {
  auth: AuthState
  onBack: () => void
}

export function ProfilePage({ auth, onBack }: ProfilePageProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/social/me/stats', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .finally(() => setLoading(false))
  }, [auth.token])

  const topCards = stats
    ? Object.entries(stats.card_play_counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  return (
    <div className="pp-root">
      <div className="pp-scanlines" />

      <header className="pp-header">
        <button className="pp-back-btn" onClick={onBack}>← BACK</button>
        <div>
          <h1 className="pp-title">PROFILE</h1>
          <p className="pp-subtitle">BATTLE RECORD</p>
        </div>
      </header>

      <div className="pp-content">
        {loading && <p className="pp-loading">LOADING DATA…</p>}

        {stats && (
          <>
            {/* Identity */}
            <div className="pp-identity">
              <div className="pp-avatar">⚔</div>
              <div className="pp-identity-info">
                <span className="pp-callsign">{stats.username.toUpperCase()}</span>
                <span className="pp-rank">{stats.games_played >= 50 ? 'VETERAN' : stats.games_played >= 10 ? 'WARRIOR' : 'RECRUIT'}</span>
              </div>
            </div>

            {/* Main stats grid */}
            <div className="pp-stats-grid">
              <div className="pp-stat-block pp-block-blue">
                <span className="pp-stat-big">{stats.games_played}</span>
                <span className="pp-stat-name">GAMES PLAYED</span>
              </div>
              <div className="pp-stat-block pp-block-green">
                <span className="pp-stat-big">{stats.games_won}</span>
                <span className="pp-stat-name">VICTORIES</span>
              </div>
              <div className="pp-stat-block pp-block-red">
                <span className="pp-stat-big">{stats.games_lost}</span>
                <span className="pp-stat-name">DEFEATS</span>
              </div>
              <div className="pp-stat-block pp-block-yellow">
                <span className="pp-stat-big">{stats.win_rate}%</span>
                <span className="pp-stat-name">WIN RATE</span>
              </div>
            </div>

            {/* Win rate bar */}
            <div className="pp-bar-section">
              <div className="pp-bar-label">
                <span>WIN RATE</span>
                <span>{stats.win_rate}%</span>
              </div>
              <div className="pp-bar-track">
                <div
                  className="pp-bar-fill"
                  style={{ width: `${stats.win_rate}%` }}
                />
              </div>
            </div>

            {/* Card stats */}
            <div className="pp-card-stats">
              {stats.favorite_card && (
                <div className="pp-card-stat pp-cs-fav">
                  <div className="pp-cs-label">FAVORITE CARD</div>
                  <div className="pp-cs-name">{stats.favorite_card.name}</div>
                  <div className="pp-cs-type">{stats.favorite_card.type.toUpperCase()} — played {stats.favorite_card.count}×</div>
                </div>
              )}
              {stats.least_used_card && (
                <div className="pp-card-stat pp-cs-least">
                  <div className="pp-cs-label">LEAST USED</div>
                  <div className="pp-cs-name">{stats.least_used_card.name}</div>
                  <div className="pp-cs-type">{stats.least_used_card.type.toUpperCase()} — played {stats.least_used_card.count}×</div>
                </div>
              )}
            </div>

            {/* Top cards */}
            {topCards.length > 0 && (
              <div className="pp-top-cards">
                <div className="pp-section-title">MOST PLAYED CARDS</div>
                {topCards.map(([cardId, count]) => {
                  const maxCount = topCards[0][1]
                  return (
                    <div key={cardId} className="pp-top-card-row">
                      <span className="pp-tc-name">Card #{cardId}</span>
                      <div className="pp-tc-bar-track">
                        <div
                          className="pp-tc-bar-fill"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="pp-tc-count">{count}×</span>
                    </div>
                  )
                })}
              </div>
            )}

            {stats.games_played === 0 && (
              <div className="pp-no-games">
                <span>No battles recorded yet.</span>
                <span>Enter the wasteland to build your legend.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
