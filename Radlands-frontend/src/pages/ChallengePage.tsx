import { useState } from 'react'
import { apiUrl } from '../lib/api'
import { toast } from '../components/Toast'
import type { AuthState } from '../App'
import { IconZap, IconClock, IconSend, IconUser } from '../components/Icons'
import './ChallengePage.css'

interface ChallengeTarget { userId: number; username: string }

type ScheduleOption = 'instant' | '5min' | '10min' | '30min' | '1hour' | 'custom'

const SCHEDULE_OPTIONS: { value: ScheduleOption; label: string; minutes?: number }[] = [
  { value: 'instant', label: 'INSTANT' },
  { value: '5min',    label: 'IN 5 MIN',  minutes: 5 },
  { value: '10min',   label: 'IN 10 MIN', minutes: 10 },
  { value: '30min',   label: 'IN 30 MIN', minutes: 30 },
  { value: '1hour',   label: 'IN 1 HOUR', minutes: 60 },
  { value: 'custom',  label: 'CUSTOM' },
]

export function ChallengePage({ auth, target, onBack }: {
  auth: AuthState
  target: ChallengeTarget
  onBack: () => void
}) {
  const [schedule, setSchedule] = useState<ScheduleOption>('instant')
  const [customDt, setCustomDt] = useState('')
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  const minDt = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)

  function getScheduledAt(): string | null {
    if (schedule === 'instant') return null
    if (schedule === 'custom') return customDt ? new Date(customDt).toISOString() : null
    const opt = SCHEDULE_OPTIONS.find(o => o.value === schedule)
    if (!opt?.minutes) return null
    return new Date(Date.now() + opt.minutes * 60 * 1000).toISOString()
  }

  function scheduleLabel(): string {
    if (schedule === 'instant') return 'Game starts as soon as they accept'
    if (schedule === 'custom' && customDt) {
      return `Scheduled for ${new Date(customDt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
    }
    const opt = SCHEDULE_OPTIONS.find(o => o.value === schedule)
    if (opt?.minutes) {
      const t = new Date(Date.now() + opt.minutes * 60 * 1000)
      return `~${t.toLocaleString([], { timeStyle: 'short' })}`
    }
    return ''
  }

  async function handleSend() {
    if (schedule === 'custom' && !customDt) {
      toast('Please pick a custom date and time', 'error')
      return
    }
    setSending(true)
    try {
      const body: Record<string, unknown> = { challenged_id: target.userId }
      const scheduledAt = getScheduledAt()
      if (scheduledAt) body.scheduled_at = scheduledAt
      if (message.trim()) body.message = message.trim()

      const r = await fetch(apiUrl('/social/challenges'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        setSent(true)
      } else {
        toast(d.detail ?? 'Failed to send challenge', 'error')
      }
    } catch {
      toast('Network error. Please try again.', 'error')
    } finally {
      setSending(false)
    }
  }

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
            <div className="cp-success-icon"><IconZap size={40} color="#d4ff00" /></div>
            <div className="cp-success-title">CHALLENGE DISPATCHED</div>
            <p className="cp-success-sub">
              {target.username.toUpperCase()} has been challenged.
              {schedule !== 'instant' && ` ${scheduleLabel()}.`}
              {' '}Game starts when they accept.
            </p>
            <button className="cp-btn-back" onClick={onBack}>RETURN TO ALLIES</button>
          </div>
        ) : (
          <div className="cp-form">
            {/* Target */}
            <div className="cp-target-card">
              <div className="cp-target-icon"><IconUser size={22} color="#d4ff00" /></div>
              <div className="cp-target-info">
                <span className="cp-target-label">CHALLENGING OPERATIVE</span>
                <span className="cp-target-name">{target.username.toUpperCase()}</span>
              </div>
              <div className="cp-target-badge"><IconZap size={14} color="#d4ff00" />CHALLENGE</div>
            </div>

            {/* Schedule */}
            <div className="cp-field">
              <label className="cp-field-label">
                <IconClock size={14} color="rgba(255,255,255,.4)" />
                WHEN TO BATTLE
              </label>
              <div className="cp-schedule-grid">
                {SCHEDULE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cp-schedule-btn ${schedule === opt.value ? 'active' : ''}`}
                    onClick={() => setSchedule(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {schedule === 'custom' && (
                <input
                  className="cp-datetime"
                  type="datetime-local"
                  value={customDt}
                  onChange={e => setCustomDt(e.target.value)}
                  min={minDt}
                />
              )}
              {scheduleLabel() && (
                <div className="cp-dt-preview">
                  <IconClock size={12} color="#00e5ff" />
                  {scheduleLabel()}
                </div>
              )}
            </div>

            {/* Message */}
            <div className="cp-field">
              <label className="cp-field-label">
                <IconSend size={14} color="rgba(255,255,255,.4)" />
                BATTLE CRY
                <span className="cp-field-note">(optional)</span>
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

            <div className="cp-actions">
              <button type="button" className="cp-btn-cancel" onClick={onBack}>CANCEL</button>
              <button type="button" className="cp-btn-send" disabled={sending} onClick={handleSend}>
                <IconZap size={15} color="#08001a" />
                {sending ? 'SENDING…' : 'SEND CHALLENGE'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
