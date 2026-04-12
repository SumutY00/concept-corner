'use client'

import { useState } from 'react'
import StoryViewer from './StoryViewer'

type Story = {
  id: string
  user_id: string
  image_url: string
  caption: string | null
  created_at: string
  expires_at: string
}

type StoryUser = {
  id: string
  username: string
  avatar_url: string | null
  stories: Story[]
  hasUnseen: boolean  // görülmemiş hikayesi var mı
}

type Props = {
  storyUsers: StoryUser[]
  currentUserId: string
  currentUsername: string
  currentAvatarUrl: string | null
  hasOwnStory: boolean
}

export default function StoryBar({
  storyUsers,
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  hasOwnStory,
}: Props) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [startIdx, setStartIdx] = useState(0)

  const openViewer = (idx: number) => {
    setStartIdx(idx)
    setViewerOpen(true)
  }

  return (
    <>
      <style>{`
        .sb-wrap {
          padding: 14px 0 10px;
          border-bottom: 1px solid var(--cc-border);
          background: var(--cc-surface);
          margin-bottom: 20px;
          border-radius: 16px;
          overflow: hidden;
        }
        .sb-scroll {
          display: flex; gap: 14px;
          overflow-x: auto; padding: 0 16px 4px;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .sb-scroll::-webkit-scrollbar { display: none; }

        .sb-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 5px; cursor: pointer; flex-shrink: 0; min-width: 64px;
          background: none; border: none; padding: 0;
        }

        /* Halka */
        .sb-ring {
          width: 68px; height: 68px; border-radius: 50%;
          padding: 3px; flex-shrink: 0; position: relative;
        }
        .sb-ring.unseen {
          background: linear-gradient(135deg, #667eea, #764ba2, #f64f59);
        }
        .sb-ring.seen {
          background: var(--cc-border);
        }
        .sb-ring.own {
          background: linear-gradient(135deg, #667eea, #764ba2);
        }
        .sb-ring-inner {
          width: 100%; height: 100%; border-radius: 50%;
          overflow: hidden;
          border: 2.5px solid var(--cc-surface);
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 700; color: var(--cc-primary);
        }
        .sb-ring-inner img { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* "+" badge — kendi avatarında */
        .sb-add-badge {
          position: absolute; bottom: 2px; right: 2px;
          width: 22px; height: 22px; border-radius: 50%;
          background: #667eea; border: 2px solid var(--cc-surface);
          display: flex; align-items: center; justify-content: center;
          color: #fff; z-index: 2;
        }

        .sb-name {
          font-size: 11px; font-weight: 500; color: var(--cc-text-secondary);
          max-width: 64px; text-align: center; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .sb-name.own { color: var(--cc-primary); }

        /* Kendi "+" butonu — hikaye yoksa */
        .sb-add-btn {
          display: flex; flex-direction: column; align-items: center;
          gap: 5px; cursor: pointer; flex-shrink: 0; min-width: 64px;
          background: none; border: none; padding: 0; text-decoration: none;
        }
        .sb-add-circle {
          width: 68px; height: 68px; border-radius: 50%;
          border: 2px dashed rgba(102,126,234,0.45);
          display: flex; align-items: center; justify-content: center;
          background: rgba(102,126,234,0.06);
          transition: border-color 0.2s, background 0.2s;
        }
        .sb-add-btn:hover .sb-add-circle {
          border-color: rgba(102,126,234,0.8); background: rgba(102,126,234,0.12);
        }
      `}</style>

      <div className="sb-wrap">
        <div className="sb-scroll">
          {/* Kendi hikayem / Ekle butonu */}
          {hasOwnStory ? (
            <button
              className="sb-item"
              onClick={() => {
                const myIdx = storyUsers.findIndex(u => u.id === currentUserId)
                if (myIdx >= 0) openViewer(myIdx)
              }}
            >
              <div className="sb-ring own">
                <div className="sb-ring-inner">
                  {currentAvatarUrl
                    ? <img src={currentAvatarUrl} alt="" />
                    : currentUsername[0]?.toUpperCase()
                  }
                </div>
                <div className="sb-add-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </div>
              </div>
              <span className="sb-name own">Hikayem</span>
            </button>
          ) : (
            <a href="/stories/new" className="sb-add-btn">
              <div className="sb-add-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <span className="sb-name own">Ekle</span>
            </a>
          )}

          {/* Diğer kullanıcıların hikayeleri */}
          {storyUsers
            .filter(u => u.id !== currentUserId)
            .map((u, idx) => {
              // Gerçek indeksi bul (currentUserId dahil listede)
              const realIdx = storyUsers.findIndex(su => su.id === u.id)
              return (
                <button
                  key={u.id}
                  className="sb-item"
                  onClick={() => openViewer(realIdx)}
                >
                  <div className={`sb-ring ${u.hasUnseen ? 'unseen' : 'seen'}`}>
                    <div className="sb-ring-inner">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" />
                        : u.username[0]?.toUpperCase()
                      }
                    </div>
                  </div>
                  <span className="sb-name">{u.username}</span>
                </button>
              )
            })
          }
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer
          users={storyUsers}
          startUserIndex={startIdx}
          currentUserId={currentUserId}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
