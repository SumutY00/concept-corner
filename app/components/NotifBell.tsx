'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { showToast } from './ToastContainer'

export default function NotifBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    // 1) İlk yüklemede okunmamış bildirim sayısını çek
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setUnreadCount(count ?? 0)

      // 2) Realtime aboneliği başlat
      const channel = supabase
        .channel(`notif-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Sayacı artır
            setUnreadCount(prev => prev + 1)

            // Toast göster
            const n = payload.new as { type?: string; message?: string }
            const messages: Record<string, string> = {
              like: '❤️ Gönderiniz beğenildi',
              comment: '💬 Yeni yorum aldınız',
              follow: '👤 Yeni takipçiniz var',
              follow_request: '📩 Yeni takip isteği',
              mention: '📢 Bir yorumda etiketlendiniz',
              reply: '💬 Yorumunuza yanıt geldi',
              badge: '🏆 Yeni bir rozet kazandınız!',
              message: '💬 Yeni mesajınız var',
            }
            const msg = messages[n.type ?? ''] || n.message || 'Yeni bildirim'
            showToast(msg, 'info')
          }
        )
        .subscribe()

      // 3) Temizlik — sayfa kapanınca aboneliği kaldır
      return () => {
        supabase.removeChannel(channel)
      }
    }

    let cleanup: (() => void) | undefined
    init().then(fn => { cleanup = fn })

    return () => { cleanup?.() }
  }, [])

  return (
    <button
      onClick={() => {
        // Sayfaya gittiğinde sayacı sıfırla
        setUnreadCount(0)
        router.push('/notifications')
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
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--cc-surface-alt)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      title="Bildirimler"
    >
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
        {/* Üst halka */}
        <circle cx="14" cy="3.5" r="2" fill="var(--cc-primary)"/>
        <circle cx="14" cy="3.5" r="0.9" fill="var(--cc-bg)"/>

        {/* Gövde */}
        <path
          d="M14 5.5 C10.5 5.5 8 8 8 11.5 L7 19.5 L21 19.5 L20 11.5 C20 8 17.5 5.5 14 5.5Z"
          fill="var(--cc-surface)"
          stroke="var(--cc-primary)"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* Alt şerit */}
        <rect
          x="6" y="19.5" width="16" height="2" rx="1"
          fill="var(--cc-surface)"
          stroke="var(--cc-primary)"
          strokeWidth="1"
        />

        {/* Tokmak — bildirim varsa kırmızı, yoksa mavi */}
        <circle
          cx="14" cy="23.5" r="2"
          fill={unreadCount > 0 ? 'var(--cc-like)' : 'var(--cc-primary)'}
          style={{ transition: 'fill 0.3s' }}
        />

        {/* Bildirim noktası — sayı göster */}
        {unreadCount > 0 && (
          <>
            <circle cx="21" cy="6" r="5" fill="var(--cc-like)">
              <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>
            </circle>
            <text
              x="21" y="8"
              textAnchor="middle"
              fill="#fff"
              fontSize="7"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </text>
          </>
        )}
      </svg>
    </button>
  )
}
