'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const supabase = createClient()

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([])
      setPosts([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    const lowerQ = q.toLowerCase()

    const { data: allUsers } = await supabase
      .from('users')
      .select('id, username, avatar_url, bio')

    const { data: allPosts } = await supabase
      .from('posts')
      .select('id, title, image_url, like_count, categories(name, icon), users(username)')
      .order('created_at', { ascending: false })

    const filteredUsers = (allUsers ?? []).filter(u =>
      u.username?.toLowerCase().includes(lowerQ)
    ).slice(0, 8)

    const filteredPosts = (allPosts ?? []).filter(p =>
      p.title?.toLowerCase().includes(lowerQ)
    ).slice(0, 12)

    setUsers(filteredUsers)
    setPosts(filteredPosts)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  const hasResults = users.length > 0 || posts.length > 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page {
          min-height: 100vh; background: #0e0c0a;
          font-family: 'DM Sans', sans-serif; color: #f0ebe3;
          position: relative;
        }

        .cc-glow {
          position: fixed; top: -160px; left: -160px;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(210,130,70,0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }

        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2.5rem;
          background: rgba(14,12,10,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .cc-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }

        .cc-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 18px; color: #f0ebe3; letter-spacing: 0.02em;
        }

        .cc-back {
          font-size: 13px; color: #6a6050; text-decoration: none;
          transition: color 0.2s;
        }
        .cc-back:hover { color: #f0ebe3; }

        .cc-container {
          position: relative; z-index: 1;
          max-width: 800px; margin: 0 auto;
          padding: 3rem 2rem;
        }

        .cc-search-wrap {
          position: relative; margin-bottom: 3rem;
        }

        .cc-search-icon {
          position: absolute; left: 18px; top: 50%;
          transform: translateY(-50%);
          color: #524840; pointer-events: none;
        }

        .cc-search-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 18px 18px 18px 52px;
          font-family: 'Playfair Display', serif;
          font-size: 22px; color: #f0ebe3; outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .cc-search-input::placeholder {
          color: #2a2420; font-style: italic;
        }

        .cc-search-input:focus {
          border-color: rgba(200,134,92,0.4);
          background: rgba(200,134,92,0.03);
        }

        .cc-loading-dot {
          position: absolute; right: 18px; top: 50%;
          transform: translateY(-50%);
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(200,134,92,0.3);
          border-top-color: #c8865c;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }

        .cc-section { margin-bottom: 2.5rem; }

        .cc-section-title {
          font-size: 11px; font-weight: 500; color: #6a6050;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 1rem;
          display: flex; align-items: center; gap: 8px;
        }

        .cc-section-title::after {
          content: ''; flex: 1; height: 1px;
          background: rgba(255,255,255,0.05);
        }

        .cc-user-list { display: flex; flex-direction: column; gap: 4px; }

        .cc-user-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px;
          text-decoration: none; color: #f0ebe3;
          transition: background 0.2s;
        }
        .cc-user-item:hover { background: rgba(200,134,92,0.08); }

        .cc-user-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(200,134,92,0.15);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 700; color: #c8865c;
          overflow: hidden; flex-shrink: 0;
          border: 1px solid rgba(200,134,92,0.15);
        }
        .cc-user-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-user-name { font-size: 14px; font-weight: 500; margin-bottom: 2px; }
        .cc-user-bio { font-size: 12px; color: #524840; font-weight: 300; }

        .cc-post-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1px;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px; overflow: hidden;
        }

        .cc-post-card {
          background: rgba(255,255,255,0.02);
          text-decoration: none; display: block;
          transition: background 0.2s;
        }
        .cc-post-card:hover { background: rgba(200,134,92,0.06); }

        .cc-post-img {
          width: 100%; aspect-ratio: 1;
          object-fit: cover; display: block;
          background: rgba(255,255,255,0.03);
        }

        .cc-post-placeholder {
          width: 100%; aspect-ratio: 1;
          background: rgba(255,255,255,0.03);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
        }

        .cc-post-info { padding: 10px 12px; }

        .cc-post-cat {
          font-size: 10px; color: #524840;
          text-transform: uppercase; letter-spacing: 0.06em;
          margin-bottom: 3px;
        }

        .cc-post-title {
          font-family: 'Playfair Display', serif;
          font-size: 14px; font-weight: 700;
          color: #f0ebe3; line-height: 1.3;
        }

        .cc-post-user { font-size: 11px; color: #3a342c; margin-top: 3px; }

        .cc-empty {
          text-align: center; padding: 4rem 2rem;
        }

        .cc-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px; color: #3a342c; margin-bottom: 8px;
        }

        .cc-empty-sub { font-size: 14px; color: #2a2420; }

        .cc-idle {
          text-align: center; padding: 5rem 2rem;
        }

        .cc-idle-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 700;
          color: #2a2420; margin-bottom: 8px;
        }

        .cc-idle-title em { font-style: italic; color: #3a342c; }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-container { padding: 2rem 1.2rem; }
          .cc-search-input { font-size: 18px; }
        }
      `}</style>

      <div className="cc-page">
        <div className="cc-glow" />

        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="rgba(200,134,92,0.15)"/>
              <circle cx="14" cy="14" r="5" fill="#c8865c"/>
              <circle cx="24" cy="12" r="3.5" fill="#a06090"/>
              <circle cx="22" cy="23" r="4" fill="#6090b0"/>
              <circle cx="13" cy="23" r="2.5" fill="#80a050"/>
            </svg>
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">← Akışa dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-search-wrap">
            <svg className="cc-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="cc-search-input"
              placeholder="Kullanıcı veya konsept ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {loading && <div className="cc-loading-dot" />}
          </div>

          {!searched && (
            <div className="cc-idle">
              <h2 className="cc-idle-title">Ne <em>arıyorsun?</em></h2>
            </div>
          )}

          {searched && !loading && !hasResults && (
            <div className="cc-empty">
              <p className="cc-empty-title">Sonuç bulunamadı.</p>
              <p className="cc-empty-sub">"{query}" için hiçbir şey yok.</p>
            </div>
          )}

          {users.length > 0 && (
            <div className="cc-section">
              <p className="cc-section-title">Kullanıcılar</p>
              <div className="cc-user-list">
                {users.map((user) => (
                  <a key={user.id} href={`/profile/${user.username}`} className="cc-user-item">
                    <div className="cc-user-avatar">
                      {user.avatar_url
                        ? <img src={user.avatar_url} alt="" />
                        : user.username?.[0]?.toUpperCase()
                      }
                    </div>
                    <div>
                      <p className="cc-user-name">{user.username}</p>
                      {user.bio && <p className="cc-user-bio">{user.bio}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div className="cc-section">
              <p className="cc-section-title">Konseptler</p>
              <div className="cc-post-grid">
                {posts.map((post) => (
                  <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                    {post.image_url
                      ? <img src={post.image_url} alt={post.title} className="cc-post-img" />
                      : (
                        <div className="cc-post-placeholder">
                          {post.categories?.icon ?? '🎨'}
                        </div>
                      )
                    }
                    <div className="cc-post-info">
                      {post.categories && (
                        <p className="cc-post-cat">{post.categories.icon} {post.categories.name}</p>
                      )}
                      <p className="cc-post-title">{post.title}</p>
                      <p className="cc-post-user">@{post.users?.username}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
