'use client'

import { useState, useEffect, useRef, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Message = {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

type OtherUser = {
  id: string
  username: string
  avatar_url: string | null
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      // Konuşmayı ve diğer katılımcıyı çek
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (!conv) { router.push('/messages'); return }

      // Erişim kontrolü
      if (conv.participant_1 !== user.id && conv.participant_2 !== user.id) {
        router.push('/messages')
        return
      }

      const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1

      const { data: otherData } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', otherId)
        .single()

      setOtherUser(otherData)

      // Mesajları çek
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])

      // Okunmamış mesajları okundu yap
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user.id)

      setLoading(false)

      // Realtime aboneliği
      const channel = supabase
        .channel(`conv-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const newMsg = payload.new as Message
            setMessages(prev => {
              // Duplicate kontrolü (optimistic update ile çakışma önleme)
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })

            // Karşı taraftan gelen mesajı okundu yap
            if (newMsg.sender_id !== user.id) {
              await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMsg.id)
            }
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    let cleanup: (() => void) | undefined
    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [conversationId])

  // Yeni mesaj gelince en alta scroll
  useEffect(() => {
    scrollToBottom(messages.length <= 20)
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || !currentUserId) return

    setSending(true)
    setInput('')

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      sender_id: currentUserId,
      content: text,
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    const { data: inserted } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: text,
      })
      .select()
      .single()

    // Optimistic mesajı gerçek mesajla değiştir
    if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))

      // conversations.last_message_at güncelle
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

      // Bildirim gönder (karşı tarafa — tercihe göre)
      if (otherUser) {
        const { data: msgPrefs } = await supabase
          .from('users').select('notification_messages').eq('id', otherUser.id).single()
        if (msgPrefs?.notification_messages !== false) {
          await supabase.from('notifications').insert({
            user_id: otherUser.id,
            actor_id: currentUserId,
            type: 'message',
            message: 'sana bir mesaj gönderdi',
          })
        }
      }
    } else {
      // Başarısız — geri al
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDay = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Bugün'
    if (d.toDateString() === yesterday.toDateString()) return 'Dün'
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  }

  // Mesajları güne göre grupla
  const grouped: { day: string; msgs: Message[] }[] = []
  messages.forEach(msg => {
    const day = formatDay(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (!last || last.day !== day) {
      grouped.push({ day, msgs: [msg] })
    } else {
      last.msgs.push(msg)
    }
  })

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

        .cc-page {
          height: 100vh; display: flex; flex-direction: column;
          background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary);
        }

        /* Üst bar */
        .cc-chat-header {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 20px; flex-shrink: 0;
          background: var(--cc-navbar); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--cc-border);
          position: sticky; top: 0; z-index: 100;
        }

        .cc-back-btn {
          background: none; border: none; cursor: pointer;
          color: var(--cc-text-muted); padding: 4px 6px; border-radius: 6px;
          display: flex; align-items: center; transition: color 0.2s, background 0.2s;
          text-decoration: none;
        }
        .cc-back-btn:hover { color: var(--cc-text-primary); background: var(--cc-surface-alt); }

        .cc-chat-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: var(--cc-surface-alt); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600; color: var(--cc-primary);
        }
        .cc-chat-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-chat-name { font-size: 15px; font-weight: 600; color: var(--cc-text-primary); }
        .cc-chat-profile-link { text-decoration: none; color: inherit; }
        .cc-chat-profile-link:hover .cc-chat-name { color: var(--cc-primary); }

        /* Mesaj alanı */
        .cc-messages {
          flex: 1; overflow-y: auto; padding: 20px 16px;
          display: flex; flex-direction: column; gap: 2px;
        }

        .cc-day-label {
          text-align: center; font-size: 11px; color: var(--cc-text-muted);
          margin: 12px 0 8px; display: flex; align-items: center; gap: 10px;
        }
        .cc-day-label::before, .cc-day-label::after {
          content: ''; flex: 1; height: 1px; background: var(--cc-border);
        }

        .cc-msg-row {
          display: flex; margin-bottom: 3px;
        }
        .cc-msg-row.mine { justify-content: flex-end; }
        .cc-msg-row.theirs { justify-content: flex-start; }

        .cc-bubble {
          max-width: 72%; padding: 10px 14px; border-radius: 18px;
          font-size: 14px; line-height: 1.5; word-break: break-word;
          position: relative;
        }

        .cc-bubble.mine {
          background: #3b82f6;
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .cc-bubble.theirs {
          background: var(--cc-surface);
          color: var(--cc-text-primary);
          border: 1px solid var(--cc-border);
          border-bottom-left-radius: 4px;
        }

        .cc-bubble-time {
          font-size: 10px; margin-top: 4px; opacity: 0.7;
          text-align: right;
        }
        .cc-bubble.mine .cc-bubble-time { color: rgba(255,255,255,0.8); }
        .cc-bubble.theirs .cc-bubble-time { color: var(--cc-text-muted); }

        /* Konsekütif mesajlar arası boşluk azalt */
        .cc-msg-row + .cc-msg-row.mine { margin-top: 1px; }
        .cc-msg-row + .cc-msg-row.theirs { margin-top: 1px; }

        /* Input alanı */
        .cc-input-bar {
          flex-shrink: 0; padding: 12px 16px;
          background: var(--cc-navbar); border-top: 1px solid var(--cc-border);
          display: flex; align-items: flex-end; gap: 10px;
        }

        .cc-input-wrap {
          flex: 1; background: var(--cc-surface);
          border: 1px solid var(--cc-border); border-radius: 22px;
          padding: 10px 16px; display: flex; align-items: flex-end;
          transition: border-color 0.2s;
        }
        .cc-input-wrap:focus-within { border-color: rgba(59,130,246,0.5); }

        .cc-input {
          flex: 1; background: none; border: none; outline: none;
          font-family: var(--cc-font-body); font-size: 14px;
          color: var(--cc-text-primary); resize: none;
          max-height: 120px; line-height: 1.5;
          scrollbar-width: thin;
        }
        .cc-input::placeholder { color: var(--cc-text-muted); }

        .cc-send-btn {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: #3b82f6; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s, transform 0.15s;
        }
        .cc-send-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.05); }
        .cc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .cc-temp { opacity: 0.6; }

        @media (max-width: 600px) {
          .cc-messages { padding: 12px 10px; }
          .cc-bubble { max-width: 85%; }
        }
      `}</style>

      <div className="cc-page">
        {/* Header */}
        <div className="cc-chat-header">
          <a href="/messages" className="cc-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </a>

          <div className="cc-chat-avatar">
            {otherUser?.avatar_url
              ? <img src={otherUser.avatar_url} alt="" />
              : otherUser?.username?.[0]?.toUpperCase()
            }
          </div>

          <a href={`/profile/${otherUser?.username}`} className="cc-chat-profile-link">
            <span className="cc-chat-name">{otherUser?.username ?? '…'}</span>
          </a>
        </div>

        {/* Mesajlar */}
        <div className="cc-messages">
          {grouped.map(group => (
            <div key={group.day}>
              <div className="cc-day-label">{group.day}</div>
              {group.msgs.map(msg => {
                const isMine = msg.sender_id === currentUserId
                const isTemp = msg.id.startsWith('temp-')
                return (
                  <div key={msg.id} className={`cc-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    <div className={`cc-bubble ${isMine ? 'mine' : 'theirs'} ${isTemp ? 'cc-temp' : ''}`}>
                      {msg.content}
                      <div className="cc-bubble-time">
                        {isTemp ? '…' : formatTime(msg.created_at)}
                        {isMine && !isTemp && (
                          <span style={{ marginLeft: 4 }}>
                            {msg.is_read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="cc-input-bar">
          <div className="cc-input-wrap">
            <textarea
              ref={inputRef}
              className="cc-input"
              placeholder="Mesaj yaz..."
              value={input}
              rows={1}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            className="cc-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
