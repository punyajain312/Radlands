import { useState, useEffect } from 'react'
import { LoginPage } from './pages/LoginPage'

interface AuthState {
  token: string
  userId: number
}

function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('radlands_token')
    const userId = localStorage.getItem('radlands_user_id')
    if (token && userId) {
      setAuth({ token, userId: Number(userId) })
    }
  }, [])

  function handleLogin(token: string, userId: number) {
    localStorage.setItem('radlands_token', token)
    localStorage.setItem('radlands_user_id', String(userId))
    setAuth({ token, userId })
  }

  function handleLogout() {
    localStorage.removeItem('radlands_token')
    localStorage.removeItem('radlands_user_id')
    setAuth(null)
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div style={{ padding: 32, color: '#d4965a' }}>
      <h2>Welcome, player #{auth.userId}</h2>
      <button onClick={handleLogout}>Log out</button>
    </div>
  )
}

export default App
