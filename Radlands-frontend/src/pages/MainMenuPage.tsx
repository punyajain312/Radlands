import { useEffect, useState } from 'react'
import type { AuthState, Page } from '../App'
import './MainMenuPage.css'

interface Stats {
  games_played: number
  games_won: number
  games_lost: number
  win_rate: number
  favorite_card: { name: string; type: string } | null
  least_used_card: { name: string; type: string } | null
}

interface MainMenuPageProps {
  auth: AuthState
  onLogout: () => void
  onNavigate: (page: Page) => void
}

const MENU_ITEMS: { id: Page; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'play',      label: 'PLAY',         sub: 'Enter the wasteland',      icon: '⚔',  color: '#ff0080' },
  { id: 'howtoplay', label: 'HOW TO PLAY',  sub: 'Learn the rules',          icon: '📖', color: '#ff6600' },
  { id: 'rulebook',  label: 'RULEBOOK',     sub: 'Full official rulebook',   icon: '📋', color: '#b700ff' },
  { id: 'friends',   label: 'FRIENDS',      sub: 'Manage your allies',       icon: '⚡', color: '#00e5ff' },
  { id: 'profile',   label: 'PROFILE',      sub: 'Your battle record',       icon: '◈',  color: '#d4ff00' },
]

export function MainMenuPage({ auth, onLogout, onNavigate }: MainMenuPageProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/social/me/stats', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {})
  }, [auth.token])

  const winRate = stats ? stats.win_rate : 0
  const played = stats?.games_played ?? 0
  const won = stats?.games_won ?? 0
  const lost = stats?.games_lost ?? 0

  return (
    <div className="mm-root">
      {/* Scanlines */}
      <div className="mm-scanlines" />

      {/* Header */}
      <header className="mm-header">
        <div className="mm-logo">RADLANDS</div>
        <div className="mm-header-right">
          <span className="mm-username">{auth.username}</span>
          <button className="mm-logout-btn" onClick={onLogout}>EXIT</button>
        </div>
      </header>

      {/* Hero strip */}
      <section className="mm-hero">
        <div className="mm-hero-text">
          <span className="mm-hero-greeting">WELCOME BACK,</span>
          <span className="mm-hero-name">{auth.username.toUpperCase()}</span>
        </div>

        {/* Quick stats bar */}
        <div className="mm-stats-bar">
          <div className="mm-stat-pill mm-stat-played">
            <span className="mm-stat-num">{played}</span>
            <span className="mm-stat-label">PLAYED</span>
          </div>
          <div className="mm-stat-sep" />
          <div className="mm-stat-pill mm-stat-won">
            <span className="mm-stat-num">{won}</span>
            <span className="mm-stat-label">WON</span>
          </div>
          <div className="mm-stat-sep" />
          <div className="mm-stat-pill mm-stat-lost">
            <span className="mm-stat-num">{lost}</span>
            <span className="mm-stat-label">LOST</span>
          </div>
          <div className="mm-stat-sep" />
          <div className="mm-stat-pill mm-stat-rate">
            <span className="mm-stat-num">{winRate}%</span>
            <span className="mm-stat-label">WIN RATE</span>
          </div>
          {stats?.favorite_card && (
            <>
              <div className="mm-stat-sep" />
              <div className="mm-stat-pill mm-stat-fav">
                <span className="mm-stat-num">{stats.favorite_card.name}</span>
                <span className="mm-stat-label">FAVORITE</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Menu grid */}
      <nav className="mm-grid">
        {MENU_ITEMS.map(item => (
          <button
            key={item.id}
            className="mm-card"
            style={{ '--card-accent': item.color } as React.CSSProperties}
            onClick={() => onNavigate(item.id)}
          >
            <span className="mm-card-icon">{item.icon}</span>
            <span className="mm-card-label">{item.label}</span>
            <span className="mm-card-sub">{item.sub}</span>
            <div className="mm-card-glow" />
          </button>
        ))}
      </nav>

      {/* Bottom dunes */}
      <svg className="mm-dunes" viewBox="0 0 1200 100" preserveAspectRatio="none">
        <path
          d="M0 100 L0 55 Q120 10 240 45 Q360 78 480 30 Q600 0 720 38 Q840 72 960 20 Q1080 0 1200 42 L1200 100 Z"
          fill="#08001a"
        />
      </svg>
    </div>
  )
}
