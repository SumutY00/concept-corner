'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type OtherInfo = {
  id: string
  username: string
  avatar_url: string | null
  is_online: boolean
  last_seen: string | null
}

type Conversation = {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string
  other: OtherInfo
  lastMessage: string
  unreadCount: number
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [startingDm, setStartingDm] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (!convs || convs.length === 0) { setLoading(false); return }

      const otherIds = convs.map(c =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      )

      const { data: users } = await supabase
        .from('users')
        .select('id, username, avatar_url, is_online, last_seen')
        .in('id', otherIds)

      const userMap: Record<string, any> = {}
      users?.forEach(u => { userMap[u.id] = u })

      const enriched: Conversation[] = await Promise.all(
        convs.map(async (c) => {
          const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1

          const { data: lastMsgs } = await supabase
            .from('messages')
            .select('content, is_read, sender_id')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)

          const { count: unread } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .eq('is_read', false)
            .neq('sender_id', user.id)

          return {
            ...c,
            other: userMap[otherId] ?? { id: otherId, username: 'Bilinmeyen', avatar_url: null, is_online: false, last_seen: null },
            lastMessage: lastMsgs?.[0]?.content ?? '',
            unreadCount: unread ?? 0,
          }
        })
      )

      setConversations(enriched)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', currentUserId ?? '')
        .limit(8)
      setSearchResults(data ?? [])
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, currentUserId])

  const startConversation = async (targetId: string) => {
    if (!currentUserId) return
    setStartingDm(targetId)

    // Mevcut konuşmayı ara
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${currentUserId},participant_2.eq.${targetId}),` +
        `and(participant_1.eq.${targetId},participant_2.eq.${currentUserId})`
      )
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    // Yeni konuşma oluştur
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ participant_1: currentUserId, participant_2: targetId })
      .select('id')
      .single()

    if (newConv) {
      router.push(`/messages/${newConv.id}`)
    }
    setStartingDm(null)
  }

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (diff < 60) return `${diff}sn`
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`
    return `${Math.floor(diff / 86400)}g`
  }

  const lastSeenText = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'az önce'
    if (m < 60) return `${m} dk önce`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} sa önce`
    if (h < 48) return 'dün'
    return `${Math.floor(h / 24)} gün önce`
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

        .cc-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: var(--cc-text-primary); }

        .cc-container { max-width: 680px; margin: 0 auto; padding: 2rem; }

        .cc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .cc-title { font-family: var(--cc-font-heading); font-size: 28px; font-weight: 700; color: var(--cc-text-primary); }

        .cc-new-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: var(--cc-radius-sm);
          background: var(--cc-gradient); border: none; cursor: pointer;
          font-family: var(--cc-font-body); font-size: 13px; font-weight: 600;
          color: #fff; transition: opacity 0.2s;
        }
        .cc-new-btn:hover { opacity: 0.88; }

        /* Arama modalı */
        .cc-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          z-index: 200; display: flex; align-items: flex-start; justify-content: center;
          padding-top: 100px;
        }
        .cc-modal {
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: var(--cc-radius); width: 100%; max-width: 460px;
          overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .cc-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--cc-border);
        }
        .cc-modal-title { font-family: var(--cc-font-heading); font-size: 16px; font-weight: 600; color: var(--cc-text-primary); }
        .cc-modal-close { background: none; border: none; cursor: pointer; color: var(--cc-text-muted); font-size: 20px; padding: 0 4px; line-height: 1; }
        .cc-modal-search {
          width: 100%; padding: 14px 20px;
          background: var(--cc-surface-alt); border: none; outline: none;
          font-family: var(--cc-font-body); font-size: 15px; color: var(--cc-text-primary);
          border-bottom: 1px solid var(--cc-border);
        }
        .cc-modal-search::placeholder { color: var(--cc-text-muted); }

        .cc-search-results { max-height: 320px; overflow-y: auto; }
        .cc-search-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px; cursor: pointer;
          transition: background 0.15s; border: none; width: 100%;
          background: none; text-align: left;
        }
        .cc-search-item:hover { background: var(--cc-surface-alt); }
        .cc-search-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 600; color: var(--cc-primary);
          overflow: hidden;
        }
        .cc-search-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-search-username { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); }
        .cc-search-empty { padding: 24px 20px; text-align: center; font-size: 14px; color: var(--cc-text-muted); }

        /* Konuşma listesi */
        .cc-conv-list { display: flex; flex-direction: column; gap: 2px; }
        .cc-conv-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: var(--cc-radius-sm);
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          text-decoration: none; color: var(--cc-text-primary);
          transition: background 0.15s; cursor: pointer;
          margin-bottom: 4px;
        }
        .cc-conv-item:hover { background: var(--cc-surface-alt); }

        .cc-conv-avatar {
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 600; color: var(--cc-primary);
          overflow: hidden; position: relative;
        }
        .cc-conv-avatar img { width: 100%; height: 100%; object-fit: cover; }

        /* Çevrimiçi nokta */
        .cc-conv-avatar-wrap { position: relative; flex-shrink: 0; }
        .cc-online-dot {
          position: absolute; bottom: 1px; right: 1px;
          width: 12px; height: 12px; border-radius: 50%;
          background: #22C55E; border: 2px solid var(--cc-surface);
          animation: onlinePulse 2.5s ease-in-out infinite;
        }
        @keyframes onlinePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }

        .cc-conv-last-seen { font-size: 11px; color: var(--cc-text-muted); margin-top: 1px; }
        .cc-conv-online-text { font-size: 11px; color: #22C55E; font-weight: 500; margin-top: 1px; }

        .cc-conv-body { flex: 1; min-width: 0; }
        .cc-conv-name { font-size: 15px; font-weight: 500; color: var(--cc-text-primary); margin-bottom: 3px; }
        .cc-conv-preview { font-size: 13px; color: var(--cc-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cc-conv-preview.unread { color: var(--cc-text-primary); font-weight: 500; }

        .cc-conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .cc-conv-time { font-size: 11px; color: var(--cc-text-muted); }
        .cc-unread-dot {
          width: 20px; height: 20px; border-radius: 50%;
          background: #3b82f6; color: #fff;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        .cc-empty { text-align: center; padding: 5rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">← Akışa dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-header">
            <h1 className="cc-title">Mesajlar</h1>
            <button className="cc-new-btn" onClick={() => setShowSearch(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Yeni Mesaj
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="cc-empty">
              <p style={{ fontSize: 40, marginBottom: 12 }}>💬</p>
              <p className="cc-empty-title">Henüz mesaj yok.</p>
              <p className="cc-empty-sub">Birisiyle konuşmaya başlamak için "Yeni Mesaj" butonuna tıkla.</p>
            </div>
          ) : (
            <div className="cc-conv-list">
              {conversations.map(conv => (
                <a key={conv.id} href={`/messages/${conv.id}`} className="cc-conv-item">
                  <div className="cc-conv-avatar-wrap">
                    <div className="cc-conv-avatar">
                      {conv.other.avatar_url
                        ? <img src={conv.other.avatar_url} alt="" />
                        : conv.other.username?.[0]?.toUpperCase()
                      }
                    </div>
                    {conv.other.is_online && <div className="cc-online-dot" />}
                  </div>
                  <div className="cc-conv-body">
                    <p className="cc-conv-name">{conv.other.username}</p>
                    <p className={`cc-conv-preview ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                      {conv.lastMessage
                        ? conv.lastMessage.length > 50
                          ? conv.lastMessage.slice(0, 50) + '…'
                          : conv.lastMessage
                        : 'Konuşma başladı'
                      }
                    </p>
                    {conv.other.is_online
                      ? <span className="cc-conv-online-text">çevrimiçi</span>
                      : conv.other.last_seen
                        ? <span className="cc-conv-last-seen">Son görülme: {lastSeenText(conv.other.last_seen)}</span>
                        : null
                    }
                  </div>
                  <div className="cc-conv-meta">
                    <span className="cc-conv-time">{timeAgo(conv.last_message_at)}</span>
                    {conv.unreadCount > 0 && (
                      <span className="cc-unread-dot">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Yeni Mesaj Modalı */}
      {showSearch && (
        <div className="cc-modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()}>
            <div className="cc-modal-header">
              <span className="cc-modal-title">Yeni Mesaj</span>
              <button className="cc-modal-close" onClick={() => setShowSearch(false)}>×</button>
            </div>
            <input
              ref={searchRef}
              autoFocus
              className="cc-modal-search"
              placeholder="Kullanıcı adı ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="cc-search-results">
              {searchLoading ? (
                <p className="cc-search-empty">Aranıyor...</p>
              ) : searchResults.length === 0 && searchQuery.trim() ? (
                <p className="cc-search-empty">Kullanıcı bulunamadı.</p>
              ) : searchResults.length === 0 ? (
                <p className="cc-search-empty">Kullanıcı adı yaz...</p>
              ) : (
                searchResults.map(u => (
                  <button
                    key={u.id}
                    className="cc-search-item"
                    disabled={startingDm === u.id}
                    onClick={() => startConversation(u.id)}
                  >
                    <div className="cc-search-avatar">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" /> : u.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="cc-search-username">
                      {startingDm === u.id ? 'Açılıyor...' : u.username}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
