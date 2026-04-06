'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { showToast } from './ToastContainer'

export default function MsgBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      // Kullanıcının konuşma ID'lerini bul
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)

      const convIds = convs?.map(c => c.id) ?? []

      if (convIds.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .eq('is_read', false)
          .neq('sender_id', user.id)

        setUnreadCount(count ?? 0)
      }

      // Realtime: yeni mesaj gelince güncelle
      const channel = supabase
        .channel(`msg-bell-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const msg = payload.new as { sender_id: string; conversation_id: string }
            if (msg.sender_id === user.id) return

            // Mesaj bu kullanıcının konuşmasına mı ait?
            const belongs = convIds.includes(msg.conversation_id)
            if (!belongs) return

            setUnreadCount(prev => prev + 1)
            showToast('💬 Yeni mesajınız var', 'info')
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    let cleanup: (() => void) | undefined
    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  return (
    <button
      onClick={() => {
        setUnreadCount(0)
        router.push('/messages')
      }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        position: 'relative',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--cc-surface-alt)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      title="Mesajlar"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cc-text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>

      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: 2,
          right: 2,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          background: '#3b82f6',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          lineHeight: 1,
          fontFamily: 'system-ui, sans-serif',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
