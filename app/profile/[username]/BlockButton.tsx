'use client'
import { useState } from 'react'

export default function BlockButton({
  blockedId,
  initialIsBlocked,
}: {
  blockedId: string
  initialIsBlocked: boolean
}) {
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleBlock() {
    setLoading(true)
    const action = isBlocked ? 'unblock' : 'block'
    const res = await fetch('/api/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_id: blockedId, action }),
    })
    if (res.ok) setIsBlocked(!isBlocked)
    setLoading(false)
    setShowConfirm(false)
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        style={{
          padding: '9px 18px',
          borderRadius: 'var(--cc-radius-sm)',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          background: isBlocked ? 'var(--cc-surface)' : 'transparent',
          color: isBlocked ? 'var(--cc-like)' : 'var(--cc-text-muted)',
          border: `1px solid ${isBlocked ? 'var(--cc-like)' : 'var(--cc-border)'}`,
          transition: 'all 0.2s',
          opacity: loading ? 0.6 : 1,
          fontFamily: 'var(--cc-font-body)',
        }}
      >
        {loading ? '...' : isBlocked ? 'Engeli Kaldır' : 'Engelle'}
      </button>

      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--cc-surface)', border: '1px solid var(--cc-border)',
              borderRadius: 'var(--cc-radius)', padding: '2rem', maxWidth: 360, width: '90%',
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--cc-text-primary)', marginBottom: 8 }}>
              {isBlocked ? 'Engeli kaldır?' : 'Kullanıcıyı engelle?'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--cc-text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {isBlocked
                ? 'Bu kullanıcının engeli kaldırılacak. Tekrar içeriklerini görebileceksin.'
                : 'Bu kullanıcı seni takip edemez, paylaşımlarını göremez. Mevcut takipleşme de kaldırılır.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--cc-radius-sm)', fontSize: 13,
                  background: 'transparent', border: '1px solid var(--cc-border)',
                  color: 'var(--cc-text-muted)', cursor: 'pointer', fontFamily: 'var(--cc-font-body)',
                }}
              >
                İptal
              </button>
              <button
                onClick={handleBlock}
                disabled={loading}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--cc-radius-sm)', fontSize: 13,
                  background: isBlocked ? 'var(--cc-primary)' : 'var(--cc-like)',
                  color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500,
                  fontFamily: 'var(--cc-font-body)', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '...' : isBlocked ? 'Evet, Kaldır' : 'Evet, Engelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
