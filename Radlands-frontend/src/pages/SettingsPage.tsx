import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/api'
import type { AuthState } from '../App'
import { toast } from '../components/Toast'
import './SettingsPage.css'

export function SettingsPage({
  auth,
  onBack,
  onUsernameChange,
}: {
  auth: AuthState
  onBack: () => void
  onUsernameChange: (u: string) => void
}) {
  const [canChange, setCanChange]       = useState(true)
  const [daysLeft, setDaysLeft]         = useState(0)
  const [newUsername, setNewUsername]   = useState('')
  const [unameLoading, setUnameLoading] = useState(false)

  const [curPass, setCurPass]         = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confPass, setConfPass]       = useState('')
  const [passLoading, setPassLoading] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/auth/me/username-change-status'), {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setCanChange(d.can_change); setDaysLeft(d.days_until_change) }
      })
  }, [auth.token])

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim()) return
    setUnameLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/me/username'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ new_username: newUsername.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(typeof data.detail === 'string' ? data.detail : 'Username change failed', 'error')
      } else {
        toast('Callsign updated!', 'success')
        setNewUsername('')
        setCanChange(false)
        setDaysLeft(7)
        onUsernameChange(data.username)
      }
    } catch { toast('Cannot reach server', 'error') }
    finally { setUnameLoading(false) }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confPass) { toast('New passwords do not match', 'error'); return }
    setPassLoading(true)
    try {
      const res = await fetch(apiUrl('/auth/me/password'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ current_password: curPass, new_password: newPass }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(typeof data.detail === 'string' ? data.detail : 'Password change failed', 'error')
      } else {
        toast('Security protocol updated!', 'success')
        setCurPass(''); setNewPass(''); setConfPass('')
      }
    } catch { toast('Cannot reach server', 'error') }
    finally { setPassLoading(false) }
  }

  return (
    <div className="sp-root">
      <div className="sp-scanlines" />

      <header className="sp-bar">
        <button className="sp-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK
        </button>
        <div className="sp-bar-center">
          <span className="sp-bar-eyebrow">OPERATIVE CONTROL</span>
          <span className="sp-bar-title">SETTINGS</span>
        </div>
        <span className="sp-bar-tag">{auth.username.toUpperCase()}</span>
      </header>

      <div className="sp-body">
        <div className="sp-panel">

          <div className="sp-block">
            <div className="sp-block-title">CHANGE CALLSIGN</div>
            {!canChange ? (
              <div className="sp-locked">
                Callsign locked — available in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </div>
            ) : (
              <form className="sp-form sp-form-row" onSubmit={handleUsernameChange}>
                <input
                  className="sp-input"
                  type="text"
                  placeholder="New callsign"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  minLength={3}
                  required
                />
                <button className="sp-btn" type="submit" disabled={unameLoading}>
                  {unameLoading ? 'UPDATING…' : 'UPDATE'}
                </button>
              </form>
            )}
            <div className="sp-hint">Callsign can only be changed once per week</div>
          </div>

          <div className="sp-divider" />

          <div className="sp-block">
            <div className="sp-block-title">CHANGE SECURITY PROTOCOL</div>
            <form className="sp-form sp-form-col" onSubmit={handlePasswordChange}>
              <input
                className="sp-input"
                type="password"
                placeholder="Current protocol"
                value={curPass}
                onChange={e => setCurPass(e.target.value)}
                required
              />
              <input
                className="sp-input"
                type="password"
                placeholder="New protocol (8+ chars, UPPER, number)"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                minLength={8}
                required
              />
              <input
                className="sp-input"
                type="password"
                placeholder="Confirm new protocol"
                value={confPass}
                onChange={e => setConfPass(e.target.value)}
                required
              />
              <button className="sp-btn" type="submit" disabled={passLoading}>
                {passLoading ? 'UPDATING…' : 'UPDATE PROTOCOL'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
