'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type RequestStatus = 'none' | 'pending' | 'accepted'

export default function FollowButton({
  followingId,
  initialIsFollowing,
  isPrivate = false,
  initialRequestStatus = 'none',
}: {
  followingId: string
  initialIsFollowing: boolean
  isPrivate?: boolean
  initialRequestStatus?: RequestStatus
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [requestStatus, setRequestStatus] = useState<RequestStatus>(initialRequestStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)

    // Takipten çık
    if (isFollowing) {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ following_id: followingId, action: 'unfollow' }),
      })
      if (res.status === 401) { router.push('/auth/login'); return }
      if (res.ok) { setIsFollowing(false); setRequestStatus('none'); router.refresh() }
      setLoading(false)
      return
    }

    // Gizli hesap — istek gönder veya iptal et
    if (isPrivate) {
      if (requestStatus === 'pending') {
        // İsteği iptal et
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: followingId, action: 'cancel_request' }),
        })
        if (res.status === 401) { router.push('/auth/login'); return }
        if (res.ok) setRequestStatus('none')
      } else {
        // İstek gönder
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: followingId, action: 'request' }),
        })
        if (res.status === 401) { router.push('/auth/login'); return }
        if (res.ok) setRequestStatus('pending')
      }
      setLoading(false)
      return
    }

    // Normal takip
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: followingId, action: 'follow' }),
    })
    if (res.status === 401) { router.push('/auth/login'); return }
    if (res.ok) { setIsFollowing(true); router.refresh() }
    setLoading(false)
  }

  // Görsel durum hesapla
  const isPending = isPrivate && requestStatus === 'pending'
  const label = loading ? '...'
    : isFollowing ? 'Takip Ediliyor'
    : isPending ? 'İstek Gönderildi'
    : isPrivate ? 'Takip İsteği Gönder'
    : 'Takip Et'

  const isActive = isFollowing
  const isGray = isPending

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '9px 24px',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.2s',
        border: (isActive || isGray) ? '1px solid rgba(255,255,255,0.12)' : 'none',
        background: isActive ? 'rgba(255,255,255,0.04)'
          : isGray ? 'rgba(255,255,255,0.06)'
          : '#c8865c',
        color: isActive ? '#7a7060' : isGray ? '#7a7060' : '#1a120a',
      }}
      onMouseEnter={e => {
        if (isActive) {
          (e.currentTarget).style.background = 'rgba(200,70,70,0.1)'
          ;(e.currentTarget).style.color = '#e08878'
          ;(e.currentTarget).style.borderColor = 'rgba(200,70,70,0.3)'
        }
      }}
      onMouseLeave={e => {
        if (isActive) {
          (e.currentTarget).style.background = 'rgba(255,255,255,0.04)'
          ;(e.currentTarget).style.color = '#7a7060'
          ;(e.currentTarget).style.borderColor = 'rgba(255,255,255,0.12)'
        }
      }}
    >
      {label}
    </button>
  )
}
