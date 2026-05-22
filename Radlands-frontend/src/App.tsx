import { useState, useEffect } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation,
} from 'react-router-dom'
import { LoginPage }     from './pages/LoginPage'
import { MainMenuPage }  from './pages/MainMenuPage'
import { FriendsPage }   from './pages/FriendsPage'
import { RulebookPage }  from './pages/RulebookPage'
import { HowToPlayPage } from './pages/HowToPlayPage'
import { ProfilePage }   from './pages/ProfilePage'
import { ChallengePage } from './pages/ChallengePage'
import { SkeletonScreen } from './components/SkeletonScreen'

export interface AuthState {
  token: string
  userId: number
  username: string
}

export type Page = 'menu' | 'friends' | 'rulebook' | 'howtoplay' | 'profile' | 'play' | 'challenge'

export interface ChallengeTarget { userId: number; username: string }

const PAGE_ROUTES: Record<Page, string> = {
  menu:      '/',
  friends:   '/friends',
  rulebook:  '/rulebook',
  howtoplay: '/howtoplay',
  profile:   '/profile',
  play:      '/play',
  challenge: '/challenge',
}

/* ── Auth state lives here — shared through props ── */
function AppInner() {
  const [auth, setAuth]   = useState<AuthState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token    = localStorage.getItem('radlands_token')
    const userId   = localStorage.getItem('radlands_user_id')
    const username = localStorage.getItem('radlands_username')
    if (token && userId && username) {
      setAuth({ token, userId: Number(userId), username })
    }
    setLoaded(true)
  }, [])

  function handleLogin(token: string, userId: number, username: string) {
    localStorage.setItem('radlands_token',    token)
    localStorage.setItem('radlands_user_id',  String(userId))
    localStorage.setItem('radlands_username', username)
    setAuth({ token, userId, username })
    navigate('/', { replace: true })
  }

  function handleLogout() {
    localStorage.removeItem('radlands_token')
    localStorage.removeItem('radlands_user_id')
    localStorage.removeItem('radlands_username')
    setAuth(null)
    navigate('/login', { replace: true })
  }

  function handleNavigate(p: Page) {
    navigate(PAGE_ROUTES[p])
  }

  function handleChallenge(friend: ChallengeTarget) {
    navigate('/challenge', { state: friend })
  }

  if (!loaded) return <SkeletonScreen />

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={auth ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />}
      />

      {/* Protected */}
      <Route
        path="/"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <MainMenuPage auth={auth} onLogout={handleLogout} onNavigate={handleNavigate} />
        }
      />
      <Route
        path="/friends"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <FriendsPage auth={auth} onBack={() => navigate(-1)} onChallenge={handleChallenge} />
        }
      />
      <Route
        path="/profile"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <ProfilePage auth={auth} onBack={() => navigate(-1)} />
        }
      />
      <Route
        path="/howtoplay"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <HowToPlayPage onBack={() => navigate(-1)} />
        }
      />
      <Route
        path="/rulebook"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <RulebookPage onBack={() => navigate(-1)} />
        }
      />
      <Route
        path="/challenge"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <ChallengeWrapper auth={auth} />
        }
      />
      <Route
        path="/play"
        element={
          !auth ? <Navigate to="/login" replace /> :
          <Navigate to="/" replace /> /* placeholder until PlayPage exists */
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={auth ? '/' : '/login'} replace />} />
    </Routes>
  )
}

/* Reads challenge target from router location state */
function ChallengeWrapper({ auth }: { auth: AuthState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const target   = location.state as ChallengeTarget | null

  if (!target) return <Navigate to="/friends" replace />

  return (
    <ChallengePage
      auth={auth}
      target={target}
      onBack={() => navigate(-1)}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
