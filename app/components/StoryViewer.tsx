'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

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
}

type Props = {
  users: StoryUser[]         // Hikayesi olan kullanıcılar (sıralı)
  startUserIndex?: number    // Hangi kullanıcıdan başlasın
  currentUserId: string
  onClose: () => void
}

const STORY_DURATION = 5000 // ms

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  return `${Math.floor(h / 24)} gün önce`
}

export default function StoryViewer({ users, startUserIndex = 0, currentUserId, onClose }: Props) {
  const [userIdx, setUserIdx] = useState(startUserIndex)
  const [storyIdx, setStoryIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewCount, setViewCount] = useState<number | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef<number | null>(null)
  const supabase = createClient()

  const curUser = users[userIdx]
  const curStory = curUser?.stories[storyIdx]

  const close = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    onClose()
  }, [onClose])

  const goNext = useCallback(() => {
    if (!curUser) return
    setProgress(0)
    if (storyIdx < curUser.stories.length - 1) {
      setStoryIdx(s => s + 1)
    } else if (userIdx < users.length - 1) {
      setUserIdx(u => u + 1)
      setStoryIdx(0)
    } else {
      close()
    }
  }, [curUser, storyIdx, userIdx, users.length, close])

  const goPrev = useCallback(() => {
    setProgress(0)
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1)
    } else if (userIdx > 0) {
      setUserIdx(u => u - 1)
      setStoryIdx(0)
    }
  }, [storyIdx, userIdx])

  // İlerleme çubuğu
  useEffect(() => {
    if (!imgLoaded || paused) return
    setProgress(0)
    if (progressRef.current) clearInterval(progressRef.current)

    const step = 100 / (STORY_DURATION / 100)
    progressRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(progressRef.current!)
          goNext()
          return 100
        }
        return p + step
      })
    }, 100)

    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [userIdx, storyIdx, imgLoaded, paused, goNext])

  // Hikaye görüntüleme kaydı + view count
  useEffect(() => {
    if (!curStory) return
    setImgLoaded(false)
    setViewCount(null)

    // View kaydet (hata yoksay)
    supabase.from('story_views')
      .insert({ story_id: curStory.id, viewer_id: currentUserId })
      .then(() => {}, () => {})

    // Kendi hikayesiyse görüntülenme sayısını çek
    if (curUser.id === currentUserId) {
      supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', curStory.id)
        .then(({ count }) => setViewCount(count ?? 0))
    }
  }, [curStory?.id])

  // ESC ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, goNext, goPrev])

  // Body scroll kilitle
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!curUser || !curStory) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      diff < 0 ? goNext() : goPrev()
    }
    touchStartX.current = null
  }

  const handleTap = (e: React.MouseEvent) => {
    const x = e.clientX
    const w = window.innerWidth
    if (x < w * 0.35) goPrev()
    else if (x > w * 0.65) goNext()
  }

  return (
    <>
      <style>{`
        .sv-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: #000; display: flex; align-items: center; justify-content: center;
        }
        .sv-container {
          position: relative; width: 100%; max-width: 430px; height: 100dvh;
          display: flex; flex-direction: column; overflow: hidden;
          user-select: none;
        }

        /* Görsel */
        .sv-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .sv-gradient-top {
          position: absolute; top: 0; left: 0; right: 0; height: 120px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.55), transparent);
          pointer-events: none; z-index: 2;
        }
        .sv-gradient-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 160px;
          background: linear-gradient(to top, rgba(0,0,0,0.65), transparent);
          pointer-events: none; z-index: 2;
        }

        /* Tap zones */
        .sv-tap-zone {
          position: absolute; top: 0; bottom: 0; width: 35%; z-index: 5; cursor: pointer;
        }
        .sv-tap-zone.left { left: 0; }
        .sv-tap-zone.right { right: 0; }

        /* Progress bars */
        .sv-progress-row {
          position: absolute; top: 10px; left: 12px; right: 12px;
          display: flex; gap: 4px; z-index: 10;
        }
        .sv-prog-seg {
          flex: 1; height: 2.5px; border-radius: 2px;
          background: rgba(255,255,255,0.28); overflow: hidden;
        }
        .sv-prog-fill {
          height: 100%; background: #fff; border-radius: 2px;
          transition: width 0.1s linear;
        }

        /* Header */
        .sv-header {
          position: absolute; top: 24px; left: 12px; right: 12px;
          display: flex; align-items: center; gap: 10px; z-index: 10;
        }
        .sv-avatar {
          width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
          border: 2px solid rgba(255,255,255,0.8); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: #fff;
          background: linear-gradient(135deg, #667eea, #764ba2);
        }
        .sv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sv-user-info { flex: 1; }
        .sv-username { font-size: 14px; font-weight: 700; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
        .sv-time { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 1px; }

        .sv-close {
          background: rgba(0,0,0,0.3); border: none; cursor: pointer;
          color: #fff; width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s; z-index: 10;
        }
        .sv-close:hover { background: rgba(0,0,0,0.5); }

        /* Caption */
        .sv-caption {
          position: absolute; bottom: ${viewCount !== null ? '56px' : '28px'}; left: 20px; right: 20px;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          border-radius: 10px; padding: 10px 14px;
          font-size: 14px; color: #fff; text-align: center;
          line-height: 1.5; z-index: 10;
        }

        /* View count */
        .sv-views {
          position: absolute; bottom: 18px; left: 0; right: 0;
          display: flex; align-items: center; justify-content: center;
          gap: 6px; z-index: 10;
        }
        .sv-views-text { font-size: 13px; color: rgba(255,255,255,0.8); font-weight: 500; }

        /* Loading spinner */
        .sv-spinner {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          z-index: 3;
        }
        .sv-spin {
          width: 36px; height: 36px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          animation: svSpin 0.7s linear infinite;
        }
        @keyframes svSpin { to { transform: rotate(360deg); } }

        @media (min-width: 431px) {
          .sv-overlay { background: rgba(0,0,0,0.85); }
          .sv-container { border-radius: 16px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.8); }
        }
      `}</style>

      <div
        className="sv-overlay"
        onClick={e => { if (e.target === e.currentTarget) close() }}
      >
        <div
          className="sv-container"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Görsel */}
          <img
            key={curStory.id}
            src={curStory.image_url}
            alt=""
            className="sv-img"
            onLoad={() => setImgLoaded(true)}
            draggable={false}
          />
          {!imgLoaded && (
            <div className="sv-spinner"><div className="sv-spin" /></div>
          )}

          {/* Gradients */}
          <div className="sv-gradient-top" />
          <div className="sv-gradient-bottom" />

          {/* Tap zones */}
          <div className="sv-tap-zone left" onClick={goPrev} />
          <div className="sv-tap-zone right" onClick={goNext} />

          {/* Progress bars */}
          <div className="sv-progress-row">
            {curUser.stories.map((s, i) => (
              <div key={s.id} className="sv-prog-seg">
                <div
                  className="sv-prog-fill"
                  style={{
                    width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="sv-header">
            <div className="sv-avatar">
              {curUser.avatar_url
                ? <img src={curUser.avatar_url} alt="" />
                : curUser.username[0]?.toUpperCase()
              }
            </div>
            <div className="sv-user-info">
              <div className="sv-username">{curUser.username}</div>
              <div className="sv-time">{timeAgo(curStory.created_at)}</div>
            </div>
            <button
              className="sv-close"
              onClick={e => { e.stopPropagation(); close() }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Caption */}
          {curStory.caption && (
            <div className="sv-caption" style={{ bottom: viewCount !== null ? '56px' : '28px' }}>
              {curStory.caption}
            </div>
          )}

          {/* Görüntülenme sayısı — sadece kendi hikayen */}
          {viewCount !== null && (
            <div className="sv-views">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="sv-views-text">{viewCount} görüntülenme</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
