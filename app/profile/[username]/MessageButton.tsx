'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function MessageButton({
  targetId,
  isBlocked,
}: {
  targetId: string
  isBlocked: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  if (isBlocked) return null

  const handleClick = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Mevcut konuşmayı ara
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${user.id},participant_2.eq.${targetId}),` +
        `and(participant_1.eq.${targetId},participant_2.eq.${user.id})`
      )
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    // Yeni konuşma oluştur
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ participant_1: user.id, participant_2: targetId })
      .select('id')
      .single()

    if (newConv) {
      router.push(`/messages/${newConv.id}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '9px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.2s',
        background: 'var(--cc-surface)',
        border: '1px solid var(--cc-border)',
        color: 'var(--cc-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cc-text-muted)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cc-text-primary)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cc-border)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cc-text-secondary)'
      }}
    >
      {loading ? '...' : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Mesaj
        </>
      )}
    </button>
  )
}
