'use client'

import { useState, useEffect, useRef, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Message = {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  read_at: string | null
  delivered_at: string | null
  created_at: string
}

type OtherUser = {
  id: string
  username: string
  avatar_url: string | null
  is_online: boolean
  last_seen: string | null
}

interface SenderGroup {
  senderId: string
  isMine: boolean
  messages: Message[]
}

function buildSenderGroups(msgs: Message[], currentUserId: string): SenderGroup[] {
  const groups: SenderGroup[] = []
  for (const msg of msgs) {
    const last = groups[groups.length - 1]
    if (!last || last.senderId !== msg.sender_id) {
      groups.push({ senderId: msg.sender_id, isMine: msg.sender_id === currentUserId, messages: [msg] })
    } else {
      last.messages.push(msg)
    }
  }
  return groups
}

function TickIcon({ status }: { status: 'sending' | 'sent' | 'read' }) {
  if (status === 'sending') {
    return <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 3 }}>···</span>
  }
  const color = status === 'read' ? '#a5b4fc' : 'rgba(255,255,255,0.5)'
  // Double tick SVG
  return (
    <svg width="17" height="9" viewBox="0 0 17 9" fill="none" style={{ marginLeft: 3, flexShrink: 0, verticalAlign: 'middle' }}>
      <path d="M1 4.5L3.5 7.5L7.5 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 4.5L8 7.5L12 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function lastSeenText(dateStr: string | null | undefined): string {
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

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [otherTyping, setOtherTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const convChannelRef = useRef<any>(null)
  const typingClearRef = useRef<NodeJS.Timeout | null>(null)
  const stopTypingRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const scrollToBottom = (instant = false) => {
    bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
  }

  useEffect(() => {
    let userChannel: any = null
    let presenceInterval: NodeJS.Timeout | null = null

    const updatePresence = (online: boolean) =>
      supabase.rpc('update_user_presence', { p_is_online: online })

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      // Presence başlat
      await updatePresence(true)
      presenceInterval = setInterval(() => updatePresence(true), 30000)

      // Konuşmayı doğrula
      const { data: conv } = await supabase
        .from('conversations').select('*').eq('id', conversationId).single()
      if (!conv) { router.push('/messages'); return }
      if (conv.participant_1 !== user.id && conv.participant_2 !== user.id) {
        router.push('/messages'); return
      }

      const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1

      // Diğer kullanıcı (is_online + last_seen dahil)
      const { data: otherData } = await supabase
        .from('users')
        .select('id, username, avatar_url, is_online, last_seen')
        .eq('id', otherId)
        .single()

      setOtherUser(otherData ?? { id: otherId, username: 'Bilinmeyen', avatar_url: null, is_online: false, last_seen: null })

      // Mesajları çek
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, content, is_read, read_at, delivered_at, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(msgs ?? [])

      // Okunmamış mesajları okundu yap
      const now = new Date().toISOString()
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: now })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user.id)

      setLoading(false)

      // Mesaj kanalı: INSERT + UPDATE + typing broadcast
      const convCh = supabase
        .channel(`conv-${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, async (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Karşı taraftan gelen mesajı anında okundu yap
          if (newMsg.sender_id !== user.id) {
            await supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const upd = payload.new as Message
          setMessages(prev => prev.map(m => m.id === upd.id ? { ...m, ...upd } : m))
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload?.userId === user.id) return
          const isTyping = payload?.isTyping ?? false
          setOtherTyping(isTyping)
          if (typingClearRef.current) clearTimeout(typingClearRef.current)
          if (isTyping) {
            typingClearRef.current = setTimeout(() => setOtherTyping(false), 3500)
          }
        })
        .subscribe()

      convChannelRef.current = convCh

      // Diğer kullanıcının presence değişimlerini dinle
      userChannel = supabase
        .channel(`up-${otherId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${otherId}`,
        }, (payload) => {
          setOtherUser(prev => prev
            ? { ...prev, is_online: !!payload.new.is_online, last_seen: payload.new.last_seen ?? null }
            : prev
          )
        })
        .subscribe()
    }

    const handleUnload = () => updatePresence(false)
    window.addEventListener('beforeunload', handleUnload)

    init()

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      if (presenceInterval) clearInterval(presenceInterval)
      if (typingClearRef.current) clearTimeout(typingClearRef.current)
      if (stopTypingRef.current) clearTimeout(stopTypingRef.current)
      if (convChannelRef.current) supabase.removeChannel(convChannelRef.current)
      if (userChannel) supabase.removeChannel(userChannel)
      updatePresence(false)
    }
  }, [conversationId])

  // Yeni mesaj / typing → en alta scroll
  useEffect(() => { scrollToBottom(messages.length <= 20) }, [messages])
  useEffect(() => { if (otherTyping) scrollToBottom() }, [otherTyping])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'

    // Typing broadcast
    if (convChannelRef.current && currentUserId) {
      convChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: true },
      })
      if (stopTypingRef.current) clearTimeout(stopTypingRef.current)
      stopTypingRef.current = setTimeout(() => {
        convChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false },
        })
      }, 3000)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || !currentUserId) return

    setSending(true)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Typing durdur
    convChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: false },
    })
    if (stopTypingRef.current) clearTimeout(stopTypingRef.current)

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId, sender_id: currentUserId, content: text,
      is_read: false, read_at: null, delivered_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, content: text })
      .select()
      .single()

    if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

      if (otherUser) {
        const { data: prefs } = await supabase
          .from('users').select('notification_messages').eq('id', otherUser.id).single()
        if (prefs?.notification_messages !== false) {
          await supabase.from('notifications').insert({
            user_id: otherUser.id, actor_id: currentUserId,
            type: 'message', message: 'sana bir mesaj gönderdi',
          })
        }
      }
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  const formatDay = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Bugün'
    if (d.toDateString() === yesterday.toDateString()) return 'Dün'
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  }

  const getTickStatus = (msg: Message): 'sending' | 'sent' | 'read' => {
    if (msg.id.startsWith('temp-')) return 'sending'
    if (msg.is_read || msg.read_at) return 'read'
    return 'sent'
  }

  // Güne göre grupla
  const grouped: { day: string; msgs: Message[] }[] = []
  messages.forEach(msg => {
    const day = formatDay(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (!last || last.day !== day) grouped.push({ day, msgs: [msg] })
    else last.msgs.push(msg)
  })

  // Header durum metni
  const headerStatus = () => {
    if (otherUser?.is_online)
      return <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>çevrimiçi</span>
    if (otherUser?.last_seen)
      return <span style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>Son görülme: {lastSeenText(otherUser.last_seen)}</span>
    return null
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

        .cc-page {
          height: 100dvh; display: flex; flex-direction: column;
          background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary);
        }

        /* ── HEADER ── */
        .cc-chat-header {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px; flex-shrink: 0;
          background: var(--cc-navbar);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--cc-border);
          position: sticky; top: 0; z-index: 100;
        }
        .cc-back-btn {
          background: none; border: none; cursor: pointer;
          color: var(--cc-text-muted); padding: 6px; border-radius: 8px;
          display: flex; align-items: center; transition: color 0.2s, background 0.2s;
          text-decoration: none; flex-shrink: 0;
        }
        .cc-back-btn:hover { color: var(--cc-text-primary); background: var(--cc-surface-alt); }

        .cc-chat-avatar-wrap { position: relative; flex-shrink: 0; }
        .cc-chat-avatar {
          width: 42px; height: 42px; border-radius: 50%;
          background: var(--cc-surface-alt); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: var(--cc-primary);
        }
        .cc-chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-online-dot {
          position: absolute; bottom: 1px; right: 1px;
          width: 11px; height: 11px; border-radius: 50%;
          background: #22C55E; border: 2px solid var(--cc-navbar);
        }

        .cc-chat-info { flex: 1; min-width: 0; }
        .cc-chat-name {
          font-size: 15px; font-weight: 700; color: var(--cc-text-primary);
          transition: color 0.2s;
        }
        .cc-chat-profile-link { text-decoration: none; }
        .cc-chat-profile-link:hover .cc-chat-name { color: var(--cc-primary); }
        .cc-chat-status { display: flex; align-items: center; gap: 3px; min-height: 18px; margin-top: 1px; }
        .cc-typing-text-header { font-size: 12px; color: var(--cc-primary); font-style: italic; }
        .cc-typing-dots-inline { display: inline-flex; gap: 2px; margin-left: 2px; align-items: center; }
        .cc-typing-dot-sm {
          width: 4px; height: 4px; border-radius: 50%; background: var(--cc-primary);
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        .cc-typing-dot-sm:nth-child(2) { animation-delay: 0.2s; }
        .cc-typing-dot-sm:nth-child(3) { animation-delay: 0.4s; }

        /* ── MESAJ ALANI ── */
        .cc-messages {
          flex: 1; overflow-y: auto; padding: 16px 14px 8px;
          display: flex; flex-direction: column; gap: 0;
        }
        .cc-messages::-webkit-scrollbar { width: 3px; }
        .cc-messages::-webkit-scrollbar-thumb { background: var(--cc-border); border-radius: 2px; }

        .cc-day-label {
          text-align: center; font-size: 11px; color: var(--cc-text-muted);
          margin: 14px 0 10px; display: flex; align-items: center; gap: 8px;
        }
        .cc-day-label::before, .cc-day-label::after { content: ''; flex: 1; height: 1px; background: var(--cc-border); }

        /* Gönderici grupları */
        .cc-sender-group { margin-bottom: 6px; }

        .cc-msg-row {
          display: flex; align-items: flex-end; gap: 8px;
          margin-bottom: 2px;
        }
        .cc-msg-row.mine { flex-direction: row-reverse; }

        /* Karşı taraf avatar */
        .cc-msg-avatar {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          background: var(--cc-surface-alt); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: var(--cc-primary);
        }
        .cc-msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-msg-avatar.invisible { visibility: hidden; }

        /* Balon */
        .cc-bubble {
          max-width: 68%; padding: 9px 12px 7px;
          border-radius: 18px;
          font-size: 14px; line-height: 1.5; word-break: break-word;
          transition: opacity 0.15s;
        }
        .cc-bubble.mine {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .cc-bubble.mine.not-last {
          border-bottom-right-radius: 18px;
          border-top-right-radius: 6px;
        }
        .cc-bubble.theirs {
          background: var(--cc-surface); color: var(--cc-text-primary);
          border: 1px solid var(--cc-border);
          border-bottom-left-radius: 4px;
        }
        .cc-bubble.theirs.not-last {
          border-bottom-left-radius: 18px;
          border-top-left-radius: 6px;
        }

        .cc-bubble-footer {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 1px; margin-top: 3px;
        }
        .cc-bubble-time { font-size: 10px; line-height: 1; }
        .cc-bubble.mine .cc-bubble-time { color: rgba(255,255,255,0.65); }
        .cc-bubble.theirs .cc-bubble-time { color: var(--cc-text-muted); }

        /* ── YAZILIYOR GÖSTERGESİ ── */
        .cc-typing-row {
          display: flex; align-items: flex-end; gap: 8px;
          margin-top: 4px; margin-bottom: 6px;
          animation: fadeSlideUp 0.2s ease;
        }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .cc-typing-bubble {
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 18px 18px 18px 4px;
          padding: 11px 16px;
          display: flex; gap: 5px; align-items: center;
        }
        .cc-typing-dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--cc-text-muted);
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        .cc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .cc-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }

        /* ── INPUT ── */
        .cc-input-bar {
          flex-shrink: 0; padding: 10px 14px;
          padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
          background: var(--cc-navbar); border-top: 1px solid var(--cc-border);
          display: flex; align-items: flex-end; gap: 10px;
        }
        .cc-input-wrap {
          flex: 1; background: var(--cc-surface);
          border: 1.5px solid var(--cc-border); border-radius: 22px;
          padding: 10px 16px; display: flex; align-items: flex-end;
          transition: border-color 0.2s;
        }
        .cc-input-wrap:focus-within { border-color: rgba(102,126,234,0.5); }
        .cc-input {
          flex: 1; background: none; border: none; outline: none;
          font-family: var(--cc-font-body); font-size: 14px;
          color: var(--cc-text-primary); resize: none;
          max-height: 120px; line-height: 1.5; scrollbar-width: thin;
        }
        .cc-input::placeholder { color: var(--cc-text-muted); }

        .cc-send-btn {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 14px rgba(102,126,234,0.38);
        }
        .cc-send-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.06); }
        .cc-send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        @media (max-width: 600px) {
          .cc-messages { padding: 10px 8px 6px; }
          .cc-bubble { max-width: 82%; }
        }
      `}</style>

      <div className="cc-page">
        {/* ── HEADER ── */}
        <div className="cc-chat-header">
          <a href="/messages" className="cc-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </a>

          <div className="cc-chat-avatar-wrap">
            <div className="cc-chat-avatar">
              {otherUser?.avatar_url
                ? <img src={otherUser.avatar_url} alt="" />
                : otherUser?.username?.[0]?.toUpperCase()
              }
            </div>
            {otherUser?.is_online && <div className="cc-online-dot" />}
          </div>

          <div className="cc-chat-info">
            <a href={`/profile/${otherUser?.username}`} className="cc-chat-profile-link">
              <div className="cc-chat-name">{otherUser?.username ?? '…'}</div>
            </a>
            <div className="cc-chat-status">
              {otherTyping ? (
                <>
                  <span className="cc-typing-text-header">yazıyor</span>
                  <span className="cc-typing-dots-inline">
                    <span className="cc-typing-dot-sm" />
                    <span className="cc-typing-dot-sm" />
                    <span className="cc-typing-dot-sm" />
                  </span>
                </>
              ) : headerStatus()}
            </div>
          </div>
        </div>

        {/* ── MESAJLAR ── */}
        <div className="cc-messages">
          {grouped.map(group => {
            const senderGroups = buildSenderGroups(group.msgs, currentUserId ?? '')
            return (
              <div key={group.day}>
                <div className="cc-day-label">{group.day}</div>
                {senderGroups.map((sg, sgIdx) => (
                  <div key={sgIdx} className="cc-sender-group">
                    {sg.messages.map((msg, mIdx) => {
                      const isLast = mIdx === sg.messages.length - 1
                      const isTemp = msg.id.startsWith('temp-')
                      const tickStatus = getTickStatus(msg)
                      return (
                        <div key={msg.id} className={`cc-msg-row ${sg.isMine ? 'mine' : 'theirs'}`}>
                          {/* Avatar — sadece theirs, sadece son mesajda görünür */}
                          {!sg.isMine && (
                            <div className={`cc-msg-avatar ${isLast ? '' : 'invisible'}`}>
                              {otherUser?.avatar_url
                                ? <img src={otherUser.avatar_url} alt="" />
                                : otherUser?.username?.[0]?.toUpperCase()
                              }
                            </div>
                          )}
                          <div
                            className={`cc-bubble ${sg.isMine ? 'mine' : 'theirs'}${!isLast ? ' not-last' : ''}`}
                            style={{ opacity: isTemp ? 0.65 : 1 }}
                          >
                            {msg.content}
                            <div className="cc-bubble-footer">
                              <span className="cc-bubble-time">
                                {isTemp ? '' : formatTime(msg.created_at)}
                              </span>
                              {sg.isMine && <TickIcon status={tickStatus} />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}

          {/* Yazıyor göstergesi */}
          {otherTyping && (
            <div className="cc-typing-row">
              <div className="cc-msg-avatar">
                {otherUser?.avatar_url
                  ? <img src={otherUser.avatar_url} alt="" />
                  : otherUser?.username?.[0]?.toUpperCase()
                }
              </div>
              <div className="cc-typing-bubble">
                <span className="cc-typing-dot" />
                <span className="cc-typing-dot" />
                <span className="cc-typing-dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── INPUT ── */}
        <div className="cc-input-bar">
          <div className="cc-input-wrap">
            <textarea
              ref={inputRef}
              className="cc-input"
              placeholder="Mesaj yaz..."
              value={input}
              rows={1}
              onChange={handleInputChange}
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
