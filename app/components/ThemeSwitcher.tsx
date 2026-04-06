'use client'

import { useState, useEffect } from 'react'

const themes = [
  {
    id: 'dark-social',
    name: 'Dark Social',
    desc: 'Koyu, premium',
    preview: ['#0B1020', '#4F7CFF', '#18C8FF'],
  },
  {
    id: 'soft-modern',
    name: 'Soft Modern',
    desc: 'Açık, modern',
    preview: ['#F7F8FC', '#635BFF', '#22C7A8'],
  },
  {
    id: 'minimal-energetic',
    name: 'Minimal Energetic',
    desc: 'Açık, enerjik',
    preview: ['#FCFCFE', '#FF5C7A', '#5B6CFF'],
  },
]

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState('dark-social')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('cc-theme') ?? 'dark-social'
    setCurrent(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const handleTheme = (id: string) => {
    setCurrent(id)
    document.documentElement.setAttribute('data-theme', id)
    localStorage.setItem('cc-theme', id)
    setOpen(false)
  }

  const currentTheme = themes.find(t => t.id === current)!

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--cc-surface)',
          border: '1px solid var(--cc-border)',
          borderRadius: 'var(--cc-radius-sm)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'var(--cc-font-body)',
        }}
        title="Tema değiştir"
      >
        <div style={{ display: 'flex', gap: 3 }}>
          {currentTheme.preview.map((color, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '1px solid rgba(128,128,128,0.2)' }} />
          ))}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cc-text-muted)" strokeWidth="2">
          <path d="M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
          <path d="M12 3v18M3 12h18"/>
        </svg>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--cc-surface)',
            border: '1px solid var(--cc-border)',
            borderRadius: 'var(--cc-radius)',
            padding: '8px',
            zIndex: 999,
            minWidth: 200,
            boxShadow: 'var(--cc-shadow)',
          }}>
            <p style={{ fontSize: 10, color: 'var(--cc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px', fontFamily: 'var(--cc-font-body)' }}>
              Tema Seç
            </p>
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => handleTheme(theme.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: current === theme.id ? 'var(--cc-surface-alt)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                  fontFamily: 'var(--cc-font-body)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cc-surface-alt)')}
                onMouseLeave={e => (e.currentTarget.style.background = current === theme.id ? 'var(--cc-surface-alt)' : 'transparent')}
              >
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {theme.preview.map((color, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '1px solid rgba(128,128,128,0.15)' }} />
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-text-primary)', margin: 0 }}>{theme.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', margin: 0 }}>{theme.desc}</p>
                </div>
                {current === theme.id && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cc-primary)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
