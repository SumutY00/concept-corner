'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface FollowersModalProps {
  userId: string
  username: string
  type: 'followers' | 'following'
  onClose: () => void
}

export default function FollowersModal({ userId, username, type, onClose }: FollowersModalProps) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      if (type === 'followers') {
        // Bu kullanıcıyı takip edenler
        const { data: follows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId)

        if (follows && follows.length > 0) {
          const ids = follows.map(f => f.follower_id)
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, avatar_url, bio')
            .in('id', ids)
          setUsers(userData ?? [])
        }
      } else {
        // Bu kullanıcının takip ettikleri
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId)

        if (follows && follows.length > 0) {
          const ids = follows.map(f => f.following_id)
          const { data: userData } = await supabase
            .from('users')
            .select('id, username, avatar_url, bio')
            .in('id', ids)
          setUsers(userData ?? [])
        }
      }
      setLoading(false)
    }
    load()
  }, [userId, type])

  return (
    <>
      <style>{`
        .fm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 1rem;
          animation: fmFadeIn 0.2s ease;
        }
        @keyframes fmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fm-modal {
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          border-radius: var(--cc-radius);
          width: 100%; max-width: 400px;
          max-height: 70vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: fmSlideUp 0.25s ease;
        }
        @keyframes fmSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .fm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--cc-border);
        }
        .fm-title {
          font-family: var(--cc-font-heading);
          font-size: 16px; font-weight: 700;
          color: var(--cc-text-primary);
        }
        .fm-close {
          background: none; border: none; cursor: pointer;
          color: var(--cc-text-muted); font-size: 20px;
          padding: 4px 8px; border-radius: 8px;
          transition: background 0.2s;
        }
        .fm-close:hover { background: var(--cc-surface-alt); }
        .fm-list {
          overflow-y: auto; padding: 8px 0;
          flex: 1;
        }
        .fm-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px;
          text-decoration: none; color: var(--cc-text-primary);
          transition: background 0.2s;
        }
        .fm-item:hover { background: var(--cc-surface-alt); }
        .fm-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600;
          color: var(--cc-primary);
          overflow: hidden; flex-shrink: 0;
        }
        .fm-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .fm-info { flex: 1; min-width: 0; }
        .fm-username {
          font-size: 14px; font-weight: 600;
          color: var(--cc-text-primary);
        }
        .fm-bio {
          font-size: 12px; color: var(--cc-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-top: 2px;
        }
        .fm-empty {
          text-align: center; padding: 3rem 1rem;
          color: var(--cc-text-muted); font-size: 14px;
        }
        .fm-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 3rem;
        }
        .fm-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid var(--cc-border);
          border-top-color: var(--cc-primary);
          animation: fmSpin 0.7s linear infinite;
        }
        @keyframes fmSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-modal" onClick={e => e.stopPropagation()}>
          <div className="fm-header">
            <span className="fm-title">
              {type === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
            </span>
            <button className="fm-close" onClick={onClose}>✕</button>
          </div>

          <div className="fm-list">
            {loading ? (
              <div className="fm-loading">
                <div className="fm-spinner" />
              </div>
            ) : users.length === 0 ? (
              <div className="fm-empty">
                {type === 'followers' ? 'Henüz takipçi yok' : 'Henüz kimse takip edilmiyor'}
              </div>
            ) : (
              users.map(user => (
                <a key={user.id} href={`/profile/${user.username}`} className="fm-item">
                  <div className="fm-avatar">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" />
                      : user.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div className="fm-info">
                    <div className="fm-username">{user.username}</div>
                    {user.bio && <div className="fm-bio">{user.bio}</div>}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
