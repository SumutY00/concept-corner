'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // 1) Bildirimleri çek (join yok, düz sorgu)
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (notifs && notifs.length > 0) {
        // 2) Benzersiz actor_id'leri topla
        const actorIds = [...new Set(notifs.map((n: any) => n.actor_id).filter(Boolean))]

        // 3) Bu kullanıcıların bilgilerini çek
        let actorMap: Record<string, { username: string; avatar_url: string | null }> = {}

        if (actorIds.length > 0) {
          const { data: actors } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .in('id', actorIds)

          if (actors) {
            actors.forEach((a: any) => {
              actorMap[a.id] = { username: a.username, avatar_url: a.avatar_url }
            })
          }
        }

        // 4) Bildirimlere actor bilgisini ekle
        const enriched = notifs.map((n: any) => ({
          ...n,
          actor: n.actor_id ? actorMap[n.actor_id] || null : null
        }))

        setNotifications(enriched)
      } else {
        setNotifications([])
      }

      // 5) Bekleyen takip isteklerini çek
      const { data: requests } = await supabase
        .from('follow_requests')
        .select('id, requester_id, created_at')
        .eq('target_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (requests && requests.length > 0) {
        const requesterIds = requests.map((r: any) => r.requester_id)
        const { data: requesters } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .in('id', requesterIds)

        const requesterMap: Record<string, any> = {}
        if (requesters) {
          requesters.forEach((u: any) => { requesterMap[u.id] = u })
        }

        setPendingRequests(requests.map((r: any) => ({
          ...r,
          requester: requesterMap[r.requester_id] || null
        })))
      } else {
        setPendingRequests([])
      }

      // Hepsini okundu işaretle
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setLoading(false)
    }
    load()
  }, [])

  const handleRequestAction = async (requesterId: string, action: 'accept_request' | 'reject_request') => {
    setActionLoading(requesterId + action)
    await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: requesterId, action }),
    })
    setPendingRequests(prev => prev.filter(r => r.requester_id !== requesterId))
    setActionLoading(null)
  }

  const getDisplayText = (notif: any): string => {
    if (notif.message && notif.message.trim() !== '') return notif.message
    switch (notif.type) {
      case 'like':           return 'gönderinizi beğendi'
      case 'comment':        return 'gönderinize yorum yaptı'
      case 'follow':         return 'sizi takip etti'
      case 'follow_request': return 'sizi takip etmek istiyor'
      case 'mention':        return 'bir yorumda sizi etiketledi'
      case 'reply':          return 'yorumunuza yanıt verdi'
      case 'badge':          return 'Yeni bir rozet kazandınız!'
      default:               return 'yeni bir bildirim'
    }
  }

  const getLink = (notif: any): string => {
    if (notif.post_id) return `/post/${notif.post_id}`
    if (notif.actor?.username) return `/profile/${notif.actor.username}`
    return '/notifications'
  }

  const getIcon = (type: string) => {
    if (type === 'like') return '❤️'
    if (type === 'comment') return '💬'
    if (type === 'follow') return '👤'
    if (type === 'follow_request') return '📩'
    if (type === 'mention') return '@'
    if (type === 'reply') return '↩️'
    return '🔔'
  }

  const timeAgo = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000)
    if (diff < 60) return `${diff}sn`
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`
    return `${Math.floor(diff / 86400)}g`
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cc-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--cc-border)', borderTopColor: 'var(--cc-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }
        .cc-nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; border-bottom: 1px solid var(--cc-border); background: var(--cc-navbar); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: var(--cc-text-primary); }

        .cc-container { max-width: 680px; margin: 0 auto; padding: 2.5rem 2rem; }
        .cc-title { font-family: var(--cc-font-heading); font-size: 28px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 1.5rem; }

        .cc-section-label {
          font-size: 11px; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--cc-text-muted);
          margin-bottom: 0.75rem; margin-top: 1.5rem;
        }
        .cc-section-label:first-child { margin-top: 0; }

        .cc-request-item {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: var(--cc-radius-sm);
          background: var(--cc-surface);
          border: 1px solid rgba(200,134,92,0.2);
          margin-bottom: 4px;
        }

        .cc-request-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 500; color: var(--cc-primary);
          overflow: hidden; flex-shrink: 0; text-decoration: none;
        }
        .cc-request-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-request-body { flex: 1; }
        .cc-request-text { font-size: 14px; color: var(--cc-text-primary); line-height: 1.5; }
        .cc-request-text strong { font-weight: 500; }
        .cc-request-time { font-size: 12px; color: var(--cc-text-muted); margin-top: 2px; }

        .cc-request-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .cc-btn-accept {
          padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 500;
          background: var(--cc-primary); color: #1a120a; border: none; cursor: pointer;
          font-family: var(--cc-font-body); transition: opacity 0.2s;
        }
        .cc-btn-accept:disabled { opacity: 0.5; cursor: not-allowed; }
        .cc-btn-accept:hover:not(:disabled) { opacity: 0.85; }
        .cc-btn-reject {
          padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 500;
          background: transparent; color: var(--cc-text-muted);
          border: 1px solid var(--cc-border); cursor: pointer;
          font-family: var(--cc-font-body); transition: color 0.2s, border-color 0.2s;
        }
        .cc-btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }
        .cc-btn-reject:hover:not(:disabled) { color: var(--cc-text-primary); border-color: var(--cc-text-muted); }

        .cc-notif-list { display: flex; flex-direction: column; gap: 2px; }

        .cc-notif-item {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: var(--cc-radius-sm);
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          text-decoration: none; color: var(--cc-text-primary);
          transition: background 0.2s;
          margin-bottom: 4px;
        }
        .cc-notif-item:hover { background: var(--cc-surface-alt); }
        .cc-notif-item.unread { border-left: 3px solid var(--cc-primary); }

        .cc-notif-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 500; color: var(--cc-primary);
          overflow: hidden; flex-shrink: 0;
        }
        .cc-notif-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-notif-icon {
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; flex-shrink: 0;
          margin-left: -20px; margin-top: 20px;
          border: 2px solid var(--cc-bg);
        }

        .cc-notif-body { flex: 1; }
        .cc-notif-text { font-size: 14px; color: var(--cc-text-primary); line-height: 1.5; }
        .cc-notif-text strong { font-weight: 500; }
        .cc-notif-time { font-size: 12px; color: var(--cc-text-muted); margin-top: 2px; }

        .cc-empty { text-align: center; padding: 4rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="var(--cc-surface-alt)"/>
              <circle cx="14" cy="14" r="5" fill="var(--cc-primary)"/>
              <circle cx="24" cy="12" r="3.5" fill="var(--cc-accent)"/>
              <circle cx="22" cy="23" r="4" fill="var(--cc-like)"/>
              <circle cx="13" cy="23" r="2.5" fill="var(--cc-success)"/>
            </svg>
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">← Akışa dön</a>
        </nav>

        <div className="cc-container">
          <h1 className="cc-title">Bildirimler</h1>

          {/* Bekleyen takip istekleri */}
          {pendingRequests.length > 0 && (
            <>
              <p className="cc-section-label">Takip İstekleri ({pendingRequests.length})</p>
              {pendingRequests.map(req => {
                const isActing = actionLoading?.startsWith(req.requester_id)
                return (
                  <div key={req.id} className="cc-request-item">
                    <a href={`/profile/${req.requester?.username}`} className="cc-request-avatar">
                      {req.requester?.avatar_url
                        ? <img src={req.requester.avatar_url} alt="" />
                        : req.requester?.username?.[0]?.toUpperCase() ?? '?'
                      }
                    </a>
                    <div className="cc-request-body">
                      <p className="cc-request-text">
                        <strong>{req.requester?.username ?? 'Birisi'}</strong> seni takip etmek istiyor
                      </p>
                      <p className="cc-request-time">{timeAgo(req.created_at)}</p>
                    </div>
                    <div className="cc-request-actions">
                      <button
                        className="cc-btn-accept"
                        disabled={!!isActing}
                        onClick={() => handleRequestAction(req.requester_id, 'accept_request')}
                      >
                        {isActing ? '...' : 'Onayla'}
                      </button>
                      <button
                        className="cc-btn-reject"
                        disabled={!!isActing}
                        onClick={() => handleRequestAction(req.requester_id, 'reject_request')}
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                )
              })}
              {notifications.length > 0 && <p className="cc-section-label">Tüm Bildirimler</p>}
            </>
          )}

          {notifications.length === 0 && pendingRequests.length === 0 ? (
            <div className="cc-empty">
              <p className="cc-empty-title">Henüz bildirim yok.</p>
              <p className="cc-empty-sub">Birisi seni takip ettiğinde veya gönderini beğendiğinde burada görünecek.</p>
            </div>
          ) : (
            <div className="cc-notif-list">
              {notifications.map(notif => (
                <a
                  key={notif.id}
                  href={getLink(notif)}
                  className={`cc-notif-item ${!notif.is_read ? 'unread' : ''}`}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="cc-notif-avatar">
                      {notif.actor?.avatar_url
                        ? <img src={notif.actor.avatar_url} alt="" />
                        : notif.actor?.username?.[0]?.toUpperCase() ?? '?'
                      }
                    </div>
                    <div className="cc-notif-icon">{getIcon(notif.type)}</div>
                  </div>

                  <div className="cc-notif-body">
                    <p className="cc-notif-text">
                      <strong>{notif.actor?.username ?? 'Birisi'}</strong> {getDisplayText(notif)}
                    </p>
                    <p className="cc-notif-time">{timeAgo(notif.created_at)}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
