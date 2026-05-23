import { useState, useEffect, useRef, type FormEvent } from 'react'
import { apiUrl } from '../lib/api'
import './LoginPage.css'

/* ── Google Identity Services types ── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (r: { credential: string }) => void
          }) => void
          renderButton: (el: HTMLElement, opts: object) => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function GoogleButton({ onLogin }: { onLogin: (t: string, id: number, u: string) => void }) {
  const hiddenRef = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !hiddenRef.current) return

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        setErr('')
        try {
          const res  = await fetch(apiUrl('/auth/google'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: credential }),
          })
          const data = await res.json()
          if (!res.ok) { setErr(data.detail ?? 'Google sign-in failed'); return }
          onLogin(data.access_token, data.user_id, data.username)
        } catch {
          setErr('Cannot reach server')
        }
      },
    })

    window.google.accounts.id.renderButton(hiddenRef.current, {
      theme: 'filled_black',
      size:  'large',
      text:  'continue_with',
      width: 320,
    })
  }, [onLogin])

  function handleClick() {
    const btn = hiddenRef.current?.querySelector<HTMLElement>('[role="button"]')
    btn?.click()
  }

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <div className="af-google-wrap">
      <div className="af-divider"><span>OR</span></div>
      <button type="button" className="af-google-btn-custom" onClick={handleClick}>
        <GoogleIcon />
        <span>CONTINUE WITH GOOGLE</span>
      </button>
      <div ref={hiddenRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }} />
      {err && <p className="af-error">{err}</p>}
    </div>
  )
}

interface LoginPageProps {
  onLogin: (token: string, userId: number, username: string) => void
}

type Mode = 'login' | 'register'

/* ─── CARD TEMPLATES ───────────────────────────────────────────────── */
const CARDS = [
  {
    id: 'scavenger',
    type: 'People',
    cost: 1,
    name: 'THE SCAVENGER',
    ability: '💧 Raid: Gain 1 water',
    color: '#ff0080',
    glow: 'rgba(255,0,128,0.6)',
    artClass: 'art-scavenger',
  },
  {
    id: 'bombardment',
    type: 'Event',
    cost: 3,
    name: 'BOMBARDMENT',
    ability: 'Destroy one unprotected person',
    color: '#ff6600',
    glow: 'rgba(255,102,0,0.6)',
    artClass: 'art-bombardment',
  },
  {
    id: 'extortionist',
    type: 'People',
    cost: 2,
    name: 'THE EXTORTIONIST',
    ability: '💧 Force: Opp. loses 1 water',
    color: '#b700ff',
    glow: 'rgba(183,0,255,0.6)',
    artClass: 'art-extortionist',
  },
  {
    id: 'watersilo',
    type: 'Camp',
    cost: null,
    name: 'WATER SILO',
    ability: '💧💧 Gain 2 water',
    color: '#00e5ff',
    glow: 'rgba(0,229,255,0.6)',
    artClass: 'art-watersilo',
  },
] as const

function GameCard({
  card,
  posClass,
}: {
  card: (typeof CARDS)[number]
  posClass: string
}) {
  return (
    <div
      className={`gc ${posClass}`}
      style={
        {
          '--card-color': card.color,
          '--card-glow': card.glow,
        } as React.CSSProperties
      }
    >
      <div className="gc-header">
        <span className="gc-type">{card.type}</span>
        {card.cost !== null && (
          <span className="gc-cost">
            <span className="gc-drop">💧</span>
            {card.cost}
          </span>
        )}
      </div>

      {/* Replace the div below with an <img> when you have real card art */}
      <div className={`gc-art ${card.artClass}`}>
        <span className="gc-art-label">CARD ART</span>
      </div>

      <div className="gc-name">{card.name}</div>
      <div className="gc-ability">{card.ability}</div>
    </div>
  )
}

/* ─── ANIMATED WASTELAND SCENE ─────────────────────────────────────── */
const SPARKS = 26

function Scene() {
  return (
    <div className="sc-wrap">
      {/* Neon orb */}
      <div className="sc-orb" />

      {/* Sky glow at horizon */}
      <div className="sc-horizon-glow" />
      <div className="sc-horizon-line" />

      {/* Stars */}
      {Array.from({ length: 42 }, (_, i) => (
        <div
          key={i}
          className="sc-star"
          style={{
            left: `${(i * 37 + 11) % 94 + 3}%`,
            top: `${(i * 53 + 7) % 48 + 2}%`,
            animationDelay: `${((i * 0.47) % 3).toFixed(2)}s`,
            width: i % 5 === 0 ? '2px' : '1px',
            height: i % 5 === 0 ? '2px' : '1px',
          }}
        />
      ))}

      {/* Synthwave perspective grid */}
      <svg className="sc-grid" viewBox="0 0 600 300" preserveAspectRatio="none">
        {/* Vertical lines — all converge to top-center (300, 0) */}
        {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600].map(x => (
          <line key={x} x1={x} y1="300" x2="300" y2="0"
            stroke="#ff0080" strokeWidth="0.9" opacity="0.3" />
        ))}
        {/* Horizontal lines — width = 2y at height y from top */}
        {[250, 200, 160, 125, 95, 70, 50, 35, 22, 12].map(y => (
          <line key={y}
            x1={300 - y} y1={y} x2={300 + y} y2={y}
            stroke="#ff0080" strokeWidth="0.9"
            opacity={0.1 + (y / 300) * 0.5}
          />
        ))}
      </svg>

      {/* Desert dune silhouette */}
      <svg className="sc-dunes" viewBox="0 0 600 120" preserveAspectRatio="none">
        <path
          d="M0 120 L0 68 Q45 22 100 52 Q150 78 198 42 Q248 8 305 36
             Q360 62 412 25 Q462 0 515 38 Q558 68 600 52 L600 120 Z"
          fill="#08001a"
        />
      </svg>

      {/* Ground */}
      <div className="sc-ground" />

      {/* Campfire */}
      <div className="sc-fire">
        <div className="sc-flame fl-1" />
        <div className="sc-flame fl-2" />
        <div className="sc-flame fl-3" />
        <div className="sc-fire-base" />
      </div>

      {/* Floating Radlands cards */}
      <GameCard card={CARDS[0]} posClass="pos-c1" />
      <GameCard card={CARDS[1]} posClass="pos-c2" />
      <GameCard card={CARDS[2]} posClass="pos-c3" />
      <GameCard card={CARDS[3]} posClass="pos-c4" />

      {/* Walking character */}
      <div className="sc-walker">
        <svg viewBox="0 0 50 100" width="46" height="92" fill="#180025">
          <ellipse cx="25" cy="11" rx="9" ry="9" />
          <rect x="21" y="1" width="8" height="6" rx="2" fill="#0e0018" />
          <rect x="16" y="8" width="18" height="4" rx="1" fill="#0e0018" />
          <path d="M15 20 L35 20 L39 58 L11 58 Z" />
          <path d="M25 20 L16 36 L15 20 Z" fill="#0e0018" />
          <path d="M25 20 L34 36 L35 20 Z" fill="#0e0018" />
          <rect x="13" y="43" width="24" height="3" rx="1" fill="#0e0018" />
          <rect x="3" y="21" width="12" height="5" rx="2.5" />
          <rect x="35" y="20" width="5" height="18" rx="2" />
          <rect x="39" y="23" width="11" height="4" rx="1" fill="#0e0018" />
          <rect x="39" y="27" width="4" height="7" rx="1" fill="#0e0018" />
          <rect className="sc-leg-l" x="15" y="58" width="9" height="30" rx="3" />
          <rect className="sc-leg-r" x="26" y="58" width="9" height="30" rx="3" fill="#100018" />
        </svg>
      </div>

      {/* Neon sparks from campfire */}
      {Array.from({ length: SPARKS }, (_, i) => (
        <div
          key={i}
          className="sc-spark"
          style={{
            left: `${44 + ((i * 11) % 22) - 11}%`,
            '--dur': `${1.8 + (i * 0.19) % 2.1}s`,
            '--delay': `${(i * 0.27) % 3.5}s`,
            '--drift': `${((i * 41 + 13) % 64) - 32}px`,
            '--size': `${2 + (i % 3)}px`,
            '--spark-color':
              i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#ff0080' : '#d4ff00',
          } as React.CSSProperties}
        />
      ))}

      {/* CRT scanline overlay */}
      <div className="sc-scanlines" />

      {/* Scene tagline */}
      <div className="sc-text">
        <p>DEFEND YOUR CAMPS</p>
        <p>DESTROY THEIRS</p>
      </div>
    </div>
  )
}

/* ─── LOGIN FORM ────────────────────────────────────────────────────── */
function LoginForm({
  onLogin,
  onSwitch,
}: {
  onLogin: (t: string, id: number, username: string) => void
  onSwitch: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Login failed'); return }
      onLogin(data.access_token, data.user_id, data.username)
    } catch {
      setError('Cannot reach server — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="af-wrap">
      <h1 className="af-page-title">ENTER</h1>
      <p className="af-page-sub cyan">RADLANDS WASTELAND</p>

      <div className="af-card af-card-cyan">
        <form className="af-form" onSubmit={handleSubmit} noValidate>
          <label className="af-label cyan" htmlFor="lf-user">EMAIL ACCESS</label>
          <input
            id="lf-user" className="af-input af-input-cyan" type="text"
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder="warrior@radlands.com" required minLength={3}
            autoComplete="username"
          />

          <label className="af-label cyan" htmlFor="lf-pass">ACCESS CODE</label>
          <input
            id="lf-pass" className="af-input af-input-cyan" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="• • • • • • • •" required
            autoComplete="current-password"
          />

          {error && <p className="af-error">{error}</p>}

          <button type="submit" className="af-btn af-btn-pink" disabled={loading}>
            {loading ? 'ACCESSING…' : 'ACCESS RADLANDS'}
          </button>
        </form>
        <GoogleButton onLogin={onLogin} />
      </div>

      <p className="af-switch">
        NEW OPERATIVE?{' '}
        <button type="button" className="af-switch-btn cyan" onClick={onSwitch}>
          ENLIST
        </button>
      </p>
    </div>
  )
}

/* ─── REGISTER FORM ─────────────────────────────────────────────────── */
function RegisterForm({
  onLogin,
  onSwitch,
}: {
  onLogin: (t: string, id: number, username: string) => void
  onSwitch: () => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Protocols do not match'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Registration failed'); return }
      onLogin(data.access_token, data.user_id, data.username)
    } catch {
      setError('Cannot reach server — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="af-wrap">
      <h1 className="af-page-title">ENLIST</h1>
      <p className="af-page-sub orange">JOIN THE WASTELAND</p>

      <div className="af-card af-card-orange">
        <form className="af-form" onSubmit={handleSubmit} noValidate>
          <label className="af-label orange" htmlFor="rf-user">OPERATIVE CALLSIGN</label>
          <input
            id="rf-user" className="af-input af-input-orange" type="text"
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Warrior name" required minLength={3}
            autoComplete="username"
          />

          <label className="af-label orange" htmlFor="rf-email">CONTACT FREQUENCY</label>
          <input
            id="rf-email" className="af-input af-input-orange" type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="warrior@radlands.com" required
            autoComplete="email"
          />

          <label className="af-label orange" htmlFor="rf-pass">SECURITY PROTOCOL</label>
          <input
            id="rf-pass" className="af-input af-input-orange" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="• • • • • • • •" required minLength={8}
            autoComplete="new-password"
          />
          <p className="af-hint">8+ chars • UPPER • lower • numbers</p>

          <label className="af-label orange" htmlFor="rf-confirm">CONFIRM PROTOCOL</label>
          <input
            id="rf-confirm" className="af-input af-input-orange" type="password"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="• • • • • • • •" required
            autoComplete="new-password"
          />

          {error && <p className="af-error">{error}</p>}

          <button type="submit" className="af-btn af-btn-orange" disabled={loading}>
            {loading ? 'ENLISTING…' : 'BECOME A WARRIOR'}
          </button>
        </form>
        <GoogleButton onLogin={onLogin} />
      </div>

      <p className="af-switch">
        ALREADY ENLISTED?{' '}
        <button type="button" className="af-switch-btn orange" onClick={onSwitch}>
          RETURN
        </button>
      </p>
    </div>
  )
}

/* ─── ROOT ──────────────────────────────────────────────────────────── */
export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('login')

  return (
    <div className="lp-root">
      {/*
        Slider is 200vw wide. Two full-page "slides" sit side by side.
        Login mode  → translateX(0)    → shows slide 1 [Form | Scene]
        Register    → translateX(-50%) → shows slide 2 [Scene | Form]
      */}
      <div
        className="lp-slider"
        style={{ transform: mode === 'register' ? 'translateX(-50%)' : 'translateX(0)' }}
      >
        {/* SLIDE 1 — Login */}
        <div className="lp-page">
          <div className="lp-form-panel">
            <LoginForm onLogin={onLogin} onSwitch={() => setMode('register')} />
          </div>
          <div className="lp-visual-panel">
            <Scene />
          </div>
        </div>

        {/* SLIDE 2 — Register */}
        <div className="lp-page">
          <div className="lp-visual-panel">
            <Scene />
          </div>
          <div className="lp-form-panel">
            <RegisterForm onLogin={onLogin} onSwitch={() => setMode('login')} />
          </div>
        </div>
      </div>
    </div>
  )
}
