import { useState, useEffect } from 'react'
import { LoginPage } from './pages/LoginPage'
import { MainMenuPage } from './pages/MainMenuPage'
import { FriendsPage } from './pages/FriendsPage'
import { RulebookPage } from './pages/RulebookPage'
import { HowToPlayPage } from './pages/HowToPlayPage'
import { ProfilePage } from './pages/ProfilePage'

export interface AuthState {
  token: string
  userId: number
  username: string
}

export type Page = 'menu' | 'friends' | 'rulebook' | 'howtoplay' | 'profile' | 'play'

function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [page, setPage] = useState<Page>('menu')

  useEffect(() => {
    const token = localStorage.getItem('radlands_token')
    const userId = localStorage.getItem('radlands_user_id')
    const username = localStorage.getItem('radlands_username')
    if (token && userId && username) {
      setAuth({ token, userId: Number(userId), username })
    }
  }, [])

  function handleLogin(token: string, userId: number, username: string) {
    localStorage.setItem('radlands_token', token)
    localStorage.setItem('radlands_user_id', String(userId))
    localStorage.setItem('radlands_username', username)
    setAuth({ token, userId, username })
    setPage('menu')
  }

  function handleLogout() {
    localStorage.removeItem('radlands_token')
    localStorage.removeItem('radlands_user_id')
    localStorage.removeItem('radlands_username')
    setAuth(null)
    setPage('menu')
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />
  }

  switch (page) {
    case 'friends':
      return <FriendsPage auth={auth} onBack={() => setPage('menu')} />
    case 'rulebook':
      return <RulebookPage onBack={() => setPage('menu')} />
    case 'howtoplay':
      return <HowToPlayPage onBack={() => setPage('menu')} />
    case 'profile':
      return <ProfilePage auth={auth} onBack={() => setPage('menu')} />
    default:
      return (
        <MainMenuPage
          auth={auth}
          onLogout={handleLogout}
          onNavigate={setPage}
        />
      )
  }
}

export default App
