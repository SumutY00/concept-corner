'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

let toastListeners: ((toast: Toast) => void)[] = []

export function showToast(message: string, type: ToastType = 'success') {
  const toast: Toast = { id: Date.now().toString(), message, type }
  toastListeners.forEach(l => l(toast))
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, 3000)
    }
    toastListeners.push(listener)
    return () => { toastListeners = toastListeners.filter(l => l !== listener) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      alignItems: 'center', pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          padding: '10px 20px',
          borderRadius: 100,
          fontSize: 14,
          fontWeight: 500,
          fontFamily: 'var(--cc-font-body)',
          color: '#fff',
          background: toast.type === 'success'
            ? 'var(--cc-primary)'
            : toast.type === 'error'
            ? 'var(--cc-like)'
            : '#333',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'toastIn 0.25s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast.type === 'success' && '✓ '}{toast.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
