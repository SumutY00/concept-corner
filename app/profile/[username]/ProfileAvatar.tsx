'use client'

import { useState } from 'react'
import StoryViewer from '@/app/components/StoryViewer'

type Story = {
  id: string
  user_id: string
  image_url: string
  caption: string | null
  created_at: string
  expires_at: string
}

type Props = {
  userId: string
  username: string
  avatarUrl: string | null
  stories: Story[]         // bu kullanıcının aktif hikayeleri
  currentUserId: string | null
  initials: string
}

export default function ProfileAvatar({ userId, username, avatarUrl, stories, currentUserId, initials }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const hasStory = stories.length > 0
  const canView = !!currentUserId

  const storyUser = {
    id: userId,
    username,
    avatar_url: avatarUrl,
    stories,
    hasUnseen: true,
  }

  return (
    <>
      <style>{`
        .pa-wrap { position: relative; flex-shrink: 0; }
        .pa-ring {
          width: 92px; height: 92px; border-radius: 50%; padding: 3px;
          background: ${hasStory
            ? 'linear-gradient(135deg, #667eea, #764ba2, #f64f59)'
            : 'var(--cc-border)'};
          cursor: ${hasStory && canView ? 'pointer' : 'default'};
          transition: transform 0.2s;
        }
        .pa-ring:hover { transform: ${hasStory && canView ? 'scale(1.04)' : 'none'}; }
        .pa-inner {
          width: 100%; height: 100%; border-radius: 50%;
          overflow: hidden; border: 3px solid var(--cc-surface);
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--cc-font-heading); font-size: 32px; font-weight: 700;
          color: var(--cc-primary);
        }
        .pa-inner img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>

      <div className="pa-wrap">
        <div
          className="pa-ring"
          onClick={() => hasStory && canView && setViewerOpen(true)}
          title={hasStory && canView ? 'Hikayeyi görüntüle' : undefined}
        >
          <div className="pa-inner">
            {avatarUrl
              ? <img src={avatarUrl} alt={username} />
              : initials
            }
          </div>
        </div>
      </div>

      {viewerOpen && currentUserId && (
        <StoryViewer
          users={[storyUser]}
          startUserIndex={0}
          currentUserId={currentUserId}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
