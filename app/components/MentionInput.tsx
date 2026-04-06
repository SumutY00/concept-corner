'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
}

export default function MentionInput({ value, onChange, placeholder, maxLength, className }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const searchUsers = useCallback(async (query: string) => {
    if (!query) { setSuggestions([]); return }
    const { data } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .ilike('username', `${query}%`)
      .limit(5)
    setSuggestions(data ?? [])
  }, [supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    const cursor = e.target.selectionStart ?? 0
    const atMatch = val.slice(0, cursor).match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursor - atMatch[0].length)
      setSelectedIndex(0)
      searchUsers(atMatch[1])
    } else {
      setMentionQuery(null)
      setSuggestions([])
    }
  }

  const insertMention = (username: string) => {
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + (mentionQuery?.length ?? 0) + 1)
    const newVal = `${before}@${username} ${after}`
    onChange(newVal)
    setMentionQuery(null)
    setSuggestions([])
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + username.length + 2
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length || mentionQuery === null) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[selectedIndex]) insertMention(suggestions[selectedIndex].username) }
    else if (e.key === 'Escape') { setMentionQuery(null); setSuggestions([]) }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setMentionQuery(null); setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        autoComplete="off"
      />
      {suggestions.length > 0 && mentionQuery !== null && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
          background: 'var(--cc-surface)', border: '1px solid var(--cc-border)',
          borderRadius: 'var(--cc-radius-sm)', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 50,
        }}>
          {suggestions.map((user, i) => (
            <button
              key={user.id}
              onMouseDown={e => { e.preventDefault(); insertMention(user.username) }}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--cc-font-body)', transition: 'background 0.12s',
                background: i === selectedIndex ? 'var(--cc-surface-alt)' : 'transparent',
                color: 'var(--cc-text-primary)',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'var(--cc-surface-alt)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--cc-primary)',
              }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : user.username?.[0]?.toUpperCase()
                }
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>@{user.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
