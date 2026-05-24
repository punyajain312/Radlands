import { useState, useEffect } from 'react'
import './Toast.css'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

let _listeners: Array<(t: ToastItem[]) => void> = []
let _toasts: ToastItem[] = []
let _nextId = 0

export function toast(message: string, type: ToastType = 'info') {
  const id = _nextId++
  _toasts = [..._toasts, { id, message, type }]
  _listeners.forEach(l => l(_toasts))
  setTimeout(() => dismiss(id), 4000)
}

function dismiss(id: number) {
  _toasts = _toasts.filter(t => t.id !== id)
  _listeners.forEach(l => l(_toasts))
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>(_toasts)

  useEffect(() => {
    _listeners.push(setToasts)
    return () => { _listeners = _listeners.filter(l => l !== setToasts) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
