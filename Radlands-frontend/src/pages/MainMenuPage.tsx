import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../lib/api'
import type { AuthState, Page } from '../App'
import {
  IconSword, IconBookOpen, IconUsers, IconHelpCircle,
  IconTrophy, IconTarget, IconShield,
} from '../components/Icons'
import { getRankFromRating, rankProgress } from '../constants/ranks'
import './MainMenuPage.css'

interface Stats {
  games_played: number; games_won: number; games_lost: number
  win_rate: number; rating: number
}

const HERO_PHRASES = [
  'WASTELAND AWAITS',
  'BATTLE BEGINS NOW',
  'CLAIM YOUR GLORY',
  'FORGE YOUR LEGEND',
]

const OPERATIONS = [
  { id: 'play',      Icon: IconSword,      label: 'ENTER BATTLE',  sub: 'Engage in tactical combat',   accent: '#ff0080' },
  { id: 'howtoplay', Icon: IconHelpCircle, label: 'HOW TO PLAY',   sub: 'Master the wasteland rules',  accent: '#ff6600' },
  { id: 'friends',   Icon: IconUsers,      label: 'ALLIES',        sub: 'Manage your network',         accent: '#00e5ff' },
  { id: 'rulebook',  Icon: IconBookOpen,   label: 'CODEX',         sub: 'Official rulebook archive',   accent: '#b700ff' },
]

function useTypewriter(phrases: string[]) {
  const [display, setDisplay] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const s = useRef({ phraseIdx: 0, charIdx: 0, isDeleting: false })

  useEffect(() => {
    function tick() {
      const { phraseIdx, charIdx, isDeleting } = s.current
      const current = phrases[phraseIdx]

      if (!isDeleting) {
        if (charIdx < current.length) {
          s.current.charIdx++
          setDisplay(current.slice(0, s.current.charIdx))
          timerRef.current = setTimeout(tick, 95)
        } else {
          // pause at full text, then start deleting
          timerRef.current = setTimeout(() => {
            s.current.isDeleting = true
            tick()
          }, 2400)
        }
      } else {
        if (charIdx > 0) {
          s.current.charIdx--
          setDisplay(current.slice(0, s.current.charIdx))
          timerRef.current = setTimeout(tick, 52)
        } else {
          // done deleting — move to next phrase
          s.current.isDeleting = false
          s.current.phraseIdx = (phraseIdx + 1) % phrases.length
          timerRef.current = setTimeout(tick, 180)
        }
      }
    }

    tick()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount; phrases is module-level constant

  return display
}

export function MainMenuPage({ auth, onLogout, onNavigate }: {
  auth: AuthState; onLogout: () => void; onNavigate: (p: Page) => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const heroText = useTypewriter(HERO_PHRASES)

  useEffect(() => {
    fetch(apiUrl('/social/me/stats'), { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(r => r.ok ? r.json() : null).then(d => d && setStats(d)).catch(() => {})
  }, [auth.token])

  const W      = stats?.games_won    ?? 0
  const L      = stats?.games_lost   ?? 0
  const P      = stats?.games_played ?? 0
  const R      = stats?.win_rate     ?? 0
  const rating = stats?.rating       ?? 0
  const rank   = getRankFromRating(rating)
  const pct    = rankProgress(rating)

  return (
    <div className="mm-root">
      <div className="mm-orb mm-orb-1" />
      <div className="mm-orb mm-orb-2" />
      <div className="mm-scanlines" />

      {/* ── Header bar ─────────────────────────────── */}
      <header className="mm-bar">
        <span className="mm-logo">RADLANDS</span>
        <div className="mm-bar-stats">
          <div className="mm-bar-stat">
            <span className="mm-bar-stat-label">RATING</span>
            <span className="mm-bar-stat-val">{rating}</span>
          </div>
          <div className="mm-bar-sep" />
          <div className="mm-bar-stat">
            <span className="mm-bar-stat-label">WINS</span>
            <span className="mm-bar-stat-val" style={{ color: '#d4ff00' }}>{W}</span>
          </div>
          <div className="mm-bar-sep" />
          <div className="mm-bar-stat">
            <span className="mm-bar-stat-label">RANK</span>
            <span className="mm-bar-stat-val" style={{ color: rank.color }}>{rank.name}</span>
          </div>
        </div>
        <div className="mm-bar-right">
          <span className="mm-username">{auth.username}</span>
          <button className="mm-exit" onClick={onLogout}>EXIT</button>
        </div>
      </header>

      {/* ── Main body ──────────────────────────────── */}
      <div className="mm-body">

        {/* ── Hero ───────────────────────────────── */}
        <div className="mm-hero">

          {/* Left: text + stats + CTAs */}
          <div className="mm-hero-left">
            <p className="mm-hero-eyebrow">COMMAND CENTER ONLINE</p>
            <h1 className="mm-hero-title">
              {heroText}<span className="mm-cursor">_</span>
            </h1>
            <p className="mm-hero-desc">
              Strategic conflicts across the barren frontier. Deploy your operatives,
              claim territories, and dominate the post-apocalyptic wasteland.
            </p>

            <div className="mm-chips">
              <div className="mm-chip mm-chip-blue">
                <IconTrophy size={14} color="#00e5ff" />
                <span className="mm-chip-val">{W}</span>
                <span className="mm-chip-label">VICTORIES</span>
              </div>
              <div className="mm-chip mm-chip-red">
                <IconTarget size={14} color="#ff0080" />
                <span className="mm-chip-val">{L}</span>
                <span className="mm-chip-label">DEFEATS</span>
              </div>
              <div className="mm-chip mm-chip-yellow">
                <IconShield size={14} color="#d4ff00" />
                <span className="mm-chip-val">{R}%</span>
                <span className="mm-chip-label">WIN RATE</span>
              </div>
            </div>

            <div className="mm-cta-row">
              <button className="mm-cta-primary" onClick={() => onNavigate('play')}>
                <IconSword size={16} color="#08001a" />
                START BATTLE
              </button>
              <button className="mm-cta-secondary" onClick={() => onNavigate('profile')}>
                VIEW PROFILE
              </button>
            </div>
          </div>

          {/* Right: operative card */}
          <div className="mm-hero-right">
            <div className="mm-operative-card">
              <div className="mm-op-corner mm-op-corner-tl" />
              <div className="mm-op-corner mm-op-corner-tr" />
              <div className="mm-op-corner mm-op-corner-bl" />
              <div className="mm-op-corner mm-op-corner-br" />

              <div className="mm-op-icon-wrap">
                <IconSwords size={44} color="#ff0080" />
              </div>
              <div className="mm-op-name">{auth.username.toUpperCase()}</div>
              <div className="mm-op-rank" style={{ color: rank.color }}>{rank.name} OPERATIVE</div>
              <p className="mm-op-flavor">{rank.description}</p>
              <div className="mm-op-footer">
                <span className="mm-op-footer-label">BATTLE RECORD</span>
                <span className="mm-op-footer-val">{W}W · {L}L · {R}%WR</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Operations strip ─────────────────────── */}
        <div className="mm-ops-section">
          <div className="mm-ops-header">
            <div className="mm-ops-divider-line" />
            <span className="mm-ops-label">AVAILABLE OPERATIONS</span>
            <div className="mm-ops-divider-line" />
          </div>
          <div className="mm-ops-grid">
            {OPERATIONS.map(op => (
              <button
                key={op.id}
                className="mm-op-btn"
                style={{ '--oa': op.accent } as React.CSSProperties}
                onClick={() => onNavigate(op.id as Page)}
              >
                <div className="mm-op-btn-glow" />
                <op.Icon size={26} color={op.accent} />
                <span className="mm-op-btn-label">{op.label}</span>
                <span className="mm-op-btn-sub">{op.sub}</span>
                <div className="mm-op-btn-bar" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function IconSwords({ size, color }: { size?: number; color?: string }) {
  return (
    <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="none"
         stroke={color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
