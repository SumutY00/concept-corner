'use client'

import { useState } from 'react'
import FollowersModal from './FollowersModal'

interface ProfileStatsProps {
  userId: string
  username: string
  postCount: number
  followersCount: number
  followingCount: number
}

export default function ProfileStats({ userId, username, postCount, followersCount, followingCount }: ProfileStatsProps) {
  const [modal, setModal] = useState<'followers' | 'following' | null>(null)

  return (
    <>
      <style>{`
        .ps-stats { display: flex; gap: 2rem; margin-bottom: 1.5rem; }
        .ps-stat {
          display: flex; flex-direction: column; gap: 2px;
        }
        .ps-stat-clickable {
          display: flex; flex-direction: column; gap: 2px;
          cursor: pointer; padding: 4px 0;
          border-radius: 8px; transition: opacity 0.2s;
        }
        .ps-stat-clickable:hover { opacity: 0.7; }
        .ps-stat-num {
          font-family: var(--cc-font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--cc-text-primary);
        }
        .ps-stat-label {
          font-size: 11px; color: var(--cc-text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
      `}</style>

      <div className="ps-stats">
        <div className="ps-stat">
          <span className="ps-stat-num">{postCount}</span>
          <span className="ps-stat-label">Konsept</span>
        </div>
        <div className="ps-stat-clickable" onClick={() => setModal('followers')}>
          <span className="ps-stat-num">{followersCount}</span>
          <span className="ps-stat-label">Takipçi</span>
        </div>
        <div className="ps-stat-clickable" onClick={() => setModal('following')}>
          <span className="ps-stat-num">{followingCount}</span>
          <span className="ps-stat-label">Takip</span>
        </div>
      </div>

      {modal && (
        <FollowersModal
          userId={userId}
          username={username}
          type={modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
