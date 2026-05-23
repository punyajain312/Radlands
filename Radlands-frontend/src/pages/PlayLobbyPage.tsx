import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthState } from '../App'
import { apiUrl } from '../lib/api'
import './PlayLobbyPage.css'

interface Props { auth: AuthState }

interface GameEntry {
  game_id: number
  status: string
  opponent_id: number
  opponent_username?: string
  current_turn_player_id: number
  turn_number: number
}

interface Challenge {
  challenge_id: number
  other_id: number
  other_username: string
  status: string
  message?: string
}

export function PlayLobbyPage({ auth }: Props) {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameEntry[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const headers = { Authorization: `Bearer ${auth.token}` }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [gRes, cRes] = await Promise.all([
        fetch(apiUrl('/games/'), { headers }),
        fetch(apiUrl('/social/challenges'), { headers }),
      ])
      if (!gRes.ok || !cRes.ok) throw new Error('Failed to load')
      const gData = await gRes.json()
      const cData = await cRes.json()
      setGames(gData.filter((g: GameEntry) => g.status === 'active' || g.status === 'waiting'))
      setChallenges(cData.incoming ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function acceptChallenge(challengeId: number) {
    try {
      const res = await fetch(apiUrl(`/social/challenges/${challengeId}/accept`), {
        method: 'POST', headers,
      })
      if (!res.ok) throw new Error('Failed to accept')
      const data = await res.json()
      navigate(`/game/${data.game_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to accept challenge')
    }
  }

  async function declineChallenge(challengeId: number) {
    await fetch(apiUrl(`/social/challenges/${challengeId}/decline`), { method: 'POST', headers })
    load()
  }

  if (loading) return <div className="lobby-root"><div className="lobby-spinner">LOADING...</div></div>

  return (
    <div className="lobby-root">
      <div className="lobby-header">
        <button className="lobby-back" onClick={() => navigate('/')}>← BACK</button>
        <h1 className="lobby-title">BATTLE LOBBY</h1>
      </div>

      {error && <div className="lobby-error">{error}</div>}

      <div className="lobby-section">
        <div className="lobby-section-title">Incoming Challenges</div>
        {challenges.length === 0
          ? <div className="lobby-empty">No pending challenges</div>
          : challenges.map(c => (
            <div className="lobby-card" key={c.challenge_id}>
              <div className="lobby-card-info">
                <div className="lobby-card-name">{c.other_username}</div>
                {c.message && <div className="lobby-card-meta">"{c.message}"</div>}
              </div>
              <div className="lobby-card-actions">
                <button className="btn-primary" onClick={() => acceptChallenge(c.challenge_id)}>ACCEPT</button>
                <button className="btn-danger" onClick={() => declineChallenge(c.challenge_id)}>DECLINE</button>
              </div>
            </div>
          ))
        }
      </div>

      <div className="lobby-section">
        <div className="lobby-section-title">Active Games</div>
        {games.length === 0
          ? <div className="lobby-empty">No active games — challenge a friend from the Friends page</div>
          : games.map(g => {
            const isYourTurn = g.current_turn_player_id === auth.userId
            return (
              <div className="lobby-card" key={g.game_id}>
                <div className="lobby-card-info">
                  <div className="lobby-card-name">
                    vs Player #{g.opponent_id}
                    {' '}
                    <span className={`status-badge ${isYourTurn ? 'status-your-turn' : 'status-active'}`}>
                      {isYourTurn ? 'YOUR TURN' : 'THEIR TURN'}
                    </span>
                  </div>
                  <div className="lobby-card-meta">Turn {g.turn_number} · Game #{g.game_id}</div>
                </div>
                <div className="lobby-card-actions">
                  <button className="btn-primary" onClick={() => navigate(`/game/${g.game_id}`)}>
                    RESUME
                  </button>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
