import { useState, type FormEvent } from 'react'
import type { AuthState } from '../App'
import { IconZap, IconClock, IconSend, IconUser } from '../components/Icons'
import './ChallengePage.css'

interface ChallengeTarget { userId: number; username: string }

export function ChallengePage({ auth, target, onBack }: {
  auth: AuthState
  target: ChallengeTarget
  onBack: () => void
}) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [message, setMessage]         = useState('')
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const body: Record<string, unknown> = { challenged_id: target.userId }
      if (scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString()
      if (message.trim()) body.message = message.trim()

      const r = await fetch('/social/challenges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        setSent(true)
      } else {
        setError(d.detail ?? 'Failed to send challenge.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  /* ── Min datetime = now + 5 minutes */
  const minDt = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <div className="cp-root">
      <div className="cp-scanlines" />

      <header className="cp-bar">
        <button className="cp-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          BACK
        </button>
        <div className="cp-bar-center">
          <span className="cp-bar-eyebrow">CHALLENGE INTERFACE</span>
          <span className="cp-bar-title">SEND CHALLENGE</span>
        </div>
      </header>

      <div className="cp-body">
        {sent ? (
          <div className="cp-success">
            <div className="cp-success-icon">
              <IconZap size={40} color="#d4ff00" />
            </div>
            <div className="cp-success-title">CHALLENGE DISPATCHED</div>
            <p className="cp-success-sub">
              {target.username.toUpperCase()} has been challenged to battle.
              {scheduledAt && ` Game scheduled for ${new Date(scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`}
            </p>
            <button className="cp-btn-back" onClick={onBack}>RETURN TO ALLIES</button>
          </div>
        ) : (
          <form className="cp-form" onSubmit={handleSubmit}>
            {/* Target info */}
            <div className="cp-target-card">
              <div className="cp-target-icon">
                <IconUser size={22} color="#d4ff00" />
              </div>
              <div className="cp-target-info">
                <span className="cp-target-label">CHALLENGING OPERATIVE</span>
                <span className="cp-target-name">{target.username.toUpperCase()}</span>
              </div>
              <div className="cp-target-badge">
                <IconZap size={14} color="#d4ff00" />
                CHALLENGE
              </div>
            </div>

            {/* Schedule picker */}
            <div className="cp-field">
              <label className="cp-field-label">
                <IconClock size={14} color="rgba(255,255,255,.4)" />
                SCHEDULE DATE &amp; TIME
                <span className="cp-field-note">(optional — leave blank for open challenge)</span>
              </label>
              <input
                className="cp-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                min={minDt}
              />
              {scheduledAt && (
                <div className="cp-dt-preview">
                  <IconClock size={12} color="#00e5ff" />
                  Scheduled for {new Date(scheduledAt).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                </div>
              )}
            </div>

            {/* Message */}
            <div className="cp-field">
              <label className="cp-field-label">
                <IconSend size={14} color="rgba(255,255,255,.4)" />
                BATTLE CRY
                <span className="cp-field-note">(optional message)</span>
              </label>
              <textarea
                className="cp-message"
                placeholder="Enter your battle cry or challenge message…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={200}
                rows={3}
              />
              <div className="cp-msg-count">{message.length}/200</div>
            </div>

            {error && <div className="cp-error">{error}</div>}

            {/* Actions */}
            <div className="cp-actions">
              <button type="button" className="cp-btn-cancel" onClick={onBack}>CANCEL</button>
              <button type="submit" className="cp-btn-send" disabled={sending}>
                <IconZap size={15} color="#08001a" />
                {sending ? 'SENDING…' : 'SEND CHALLENGE'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
