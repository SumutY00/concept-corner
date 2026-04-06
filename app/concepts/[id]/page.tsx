import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

async function getConceptData(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: concept } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', id)
    .single()

  if (!concept) return null

  const { data: posts } = await supabase
    .from('posts')
    .select('*, users(username, avatar_url)')
    .eq('concept_id', id)
    .order('like_count', { ascending: false })

  // Skor tablosu — kullanıcı başına toplam beğeni
  const userScores: Record<string, { username: string; avatar_url: string | null; totalLikes: number; postCount: number }> = {}

  posts?.forEach((post: any) => {
    if (!post.user_id) return
    if (!userScores[post.user_id]) {
      userScores[post.user_id] = {
        username: post.users?.username ?? '',
        avatar_url: post.users?.avatar_url ?? null,
        totalLikes: 0,
        postCount: 0,
      }
    }
    userScores[post.user_id].totalLikes += post.like_count ?? 0
    userScores[post.user_id].postCount += 1
  })

  const leaderboard = Object.entries(userScores)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.totalLikes - a.totalLikes)
    .slice(0, 10)

  const { data: { user } } = await supabase.auth.getUser()

  return { concept, posts, leaderboard, user }
}

function getDaysLeft(endDate: string) {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export default async function ConceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getConceptData(id)
  if (!data) notFound()

  const { concept, posts, leaderboard, user } = data
  const daysLeft = getDaysLeft(concept.end_date)
  const isEnded = concept.status === 'ended'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2.5rem;
          background: var(--cc-navbar); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--cc-border);
        }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: var(--cc-text-primary); }
        .cc-nav-btn { font-size: 13px; font-weight: 600; color: #fff; background: var(--cc-gradient); text-decoration: none; padding: 8px 20px; border-radius: var(--cc-radius-sm); transition: opacity 0.2s; }
        .cc-nav-btn:hover { opacity: 0.88; }

        /* HERO */
        .cc-hero {
          max-width: 1100px; margin: 0 auto;
          padding: 3rem 2rem 2rem;
          display: grid; grid-template-columns: 1fr auto;
          gap: 2rem; align-items: start;
        }

        .cc-status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 500; padding: 4px 12px;
          border-radius: 20px; margin-bottom: 1rem;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .cc-status-active { background: rgba(79,124,255,0.12); color: var(--cc-primary); }
        .cc-status-ended { background: var(--cc-surface-alt); color: var(--cc-text-muted); }
        .cc-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .cc-status-active .cc-status-dot { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .cc-concept-name {
          font-family: var(--cc-font-heading);
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 700; color: var(--cc-text-primary);
          line-height: 1.1; margin-bottom: 1rem;
        }

        .cc-concept-desc { font-size: 15px; color: var(--cc-text-secondary); line-height: 1.7; margin-bottom: 12px; max-width: 600px; }

        .cc-concept-rules {
          display: inline-flex; align-items: flex-start; gap: 8px;
          font-size: 13px; color: var(--cc-primary);
          font-style: italic; line-height: 1.6;
          background: rgba(79,124,255,0.06);
          border: 1px solid rgba(79,124,255,0.15);
          border-radius: var(--cc-radius-sm);
          padding: 10px 14px; margin-bottom: 1.5rem;
          max-width: 600px;
        }

        .cc-hero-meta { display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; }
        .cc-meta-item { display: flex; flex-direction: column; gap: 2px; }
        .cc-meta-val { font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-meta-label { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

        .cc-timer-block { text-align: center; flex-shrink: 0; }
        .cc-timer-num { font-family: var(--cc-font-heading); font-size: 64px; font-weight: 700; color: var(--cc-text-primary); line-height: 1; }
        .cc-timer-label { font-size: 12px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }

        .cc-join-btn {
          display: inline-flex; align-items: center; gap: 8px;
          margin-top: 1.5rem; padding: 12px 28px;
          background: var(--cc-primary); color: #fff;
          border-radius: var(--cc-radius-sm); font-size: 15px; font-weight: 500;
          text-decoration: none; transition: background 0.2s;
        }
        .cc-join-btn:hover { background: var(--cc-primary-hover); }

        /* LAYOUT */
        .cc-layout {
          max-width: 1100px; margin: 0 auto;
          padding: 2rem;
          display: grid; grid-template-columns: 1fr 320px;
          gap: 2.5rem; align-items: start;
        }

        /* POSTS */
        .cc-section-title {
          font-family: var(--cc-font-heading);
          font-size: 18px; font-weight: 700;
          color: var(--cc-text-primary); margin-bottom: 1.2rem;
        }

        .cc-posts-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 1px; background: var(--cc-border);
          border: 1px solid var(--cc-border);
          border-radius: var(--cc-radius); overflow: hidden;
        }

        .cc-post-card { background: var(--cc-surface); text-decoration: none; display: block; transition: background 0.2s; }
        .cc-post-card:hover { background: var(--cc-surface-alt); }
        .cc-post-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .cc-post-placeholder { width: 100%; aspect-ratio: 1; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .cc-post-info { padding: 10px 12px; }
        .cc-post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .cc-post-avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-post-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-post-username { font-size: 11px; color: var(--cc-text-muted); }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 13px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; }
        .cc-post-likes { font-size: 11px; color: var(--cc-text-muted); margin-top: 3px; }

        /* LEADERBOARD */
        .cc-leaderboard-card {
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          border-radius: var(--cc-radius);
          overflow: hidden;
          box-shadow: var(--cc-shadow);
        }

        .cc-lb-header {
          padding: 1.2rem 1.4rem;
          border-bottom: 1px solid var(--cc-border);
          font-size: 11px; font-weight: 500;
          color: var(--cc-text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .cc-lb-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--cc-border);
          text-decoration: none; color: var(--cc-text-primary);
          transition: background 0.2s;
        }
        .cc-lb-item:last-child { border-bottom: none; }
        .cc-lb-item:hover { background: var(--cc-surface-alt); }

        .cc-lb-rank {
          font-family: var(--cc-font-heading);
          font-size: 16px; font-weight: 700;
          min-width: 28px; text-align: center;
        }
        .cc-lb-rank-1 { color: #FFB547; }
        .cc-lb-rank-2 { color: #B8C1D9; }
        .cc-lb-rank-3 { color: #CD7F32; }
        .cc-lb-rank-other { color: var(--cc-text-muted); }

        .cc-lb-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; color: var(--cc-primary);
          overflow: hidden; flex-shrink: 0;
        }
        .cc-lb-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-lb-info { flex: 1; }
        .cc-lb-username { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); }
        .cc-lb-sub { font-size: 11px; color: var(--cc-text-muted); margin-top: 1px; }

        .cc-lb-score {
          font-family: var(--cc-font-heading);
          font-size: 15px; font-weight: 700;
          color: var(--cc-like); flex-shrink: 0;
        }

        .cc-lb-top3 { display: flex; align-items: flex-end; justify-content: center; gap: 12px; padding: 1.5rem 1rem 0; }
        .cc-podium { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .cc-podium-avatar { border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--cc-primary); background: var(--cc-surface-alt); }
        .cc-podium-name { font-size: 12px; font-weight: 500; color: var(--cc-text-primary); text-align: center; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cc-podium-score { font-size: 11px; color: var(--cc-text-muted); }
        .cc-podium-bar { background: var(--cc-surface-alt); border-radius: 6px 6px 0 0; width: 60px; display: flex; align-items: center; justify-content: center; }
        .cc-podium-crown { font-size: 20px; }

        .cc-empty { text-align: center; padding: 3rem; color: var(--cc-text-muted); font-size: 14px; }

        /* MOOD BOARD */
        .cc-mb { max-width: 1100px; margin: 0 auto; padding: 0 2rem 2.5rem; }
        .cc-mb-header { display: flex; align-items: center; gap: 10px; margin-bottom: 1.6rem; }
        .cc-mb-title { font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-mb-divider { height: 1px; background: var(--cc-border); max-width: 1100px; margin: 0 auto 0; }

        .cc-mb-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-bottom: 2rem; }
        .cc-mb-img { aspect-ratio: 1; border-radius: var(--cc-radius-sm); overflow: hidden; border: 1px solid var(--cc-border); transition: transform 0.2s; }
        .cc-mb-img:hover { transform: scale(1.02); }
        .cc-mb-img img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .cc-mb-palette-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 2rem; }
        .cc-mb-palette-label { font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-right: 4px; }
        .cc-mb-swatch { width: 44px; height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); position: relative; cursor: default; }
        .cc-mb-swatch-tip { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--cc-text-muted); white-space: nowrap; opacity: 0; transition: opacity 0.15s; pointer-events: none; }
        .cc-mb-swatch:hover .cc-mb-swatch-tip { opacity: 1; }

        .cc-mb-links { display: flex; flex-direction: column; gap: 8px; }
        .cc-mb-links-label { font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
        .cc-mb-link { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); text-decoration: none; color: var(--cc-text-primary); transition: background 0.2s; }
        .cc-mb-link:hover { background: var(--cc-surface-alt); }
        .cc-mb-link-icon { font-size: 15px; flex-shrink: 0; }
        .cc-mb-link-text { font-size: 13px; font-weight: 500; flex: 1; }
        .cc-mb-link-arrow { font-size: 12px; color: var(--cc-text-muted); }

        @media (max-width: 768px) {
          .cc-mb { padding: 0 1.2rem 2rem; }
          .cc-mb-images { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
        }
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-hero { grid-template-columns: 1fr; padding: 2rem 1.2rem; }
          .cc-layout { grid-template-columns: 1fr; padding: 1.2rem; }
        }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 36, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {user && <a href="/post/new" className="cc-nav-btn">+ Katıl</a>}
            <a href="/" className="cc-back">← Akışa dön</a>
          </div>
        </nav>

        {/* HERO */}
        <div className="cc-hero">
          <div>
            <div className={`cc-status-pill ${isEnded ? 'cc-status-ended' : 'cc-status-active'}`}>
              <span className="cc-status-dot" />
              {isEnded ? 'Tamamlandı' : 'Aktif Konsept'}
            </div>

            <h1 className="cc-concept-name">{concept.name}</h1>

            {concept.description && (
              <p className="cc-concept-desc">{concept.description}</p>
            )}

            {concept.rules && (
              <p className="cc-concept-rules">📋 {concept.rules}</p>
            )}

            <div className="cc-hero-meta">
              <div className="cc-meta-item">
                <span className="cc-meta-val">{posts?.length ?? 0}</span>
                <span className="cc-meta-label">Paylaşım</span>
              </div>
              <div className="cc-meta-item">
                <span className="cc-meta-val">{leaderboard.length}</span>
                <span className="cc-meta-label">Katılımcı</span>
              </div>
              <div className="cc-meta-item">
                <span className="cc-meta-val">
                  {new Date(concept.start_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
                <span className="cc-meta-label">Başlangıç</span>
              </div>
              <div className="cc-meta-item">
                <span className="cc-meta-val">
                  {new Date(concept.end_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
                <span className="cc-meta-label">Bitiş</span>
              </div>
            </div>

            {!isEnded && user && (
              <a href="/post/new" className="cc-join-btn">Konsepte Katıl →</a>
            )}
          </div>

          {!isEnded && (
            <div className="cc-timer-block">
              <div className="cc-timer-num">{daysLeft}</div>
              <div className="cc-timer-label">Gün Kaldı</div>
            </div>
          )}
        </div>

        {/* MOOD BOARD */}
        {concept.mood_board && (
          (concept.mood_board.images?.length > 0 || concept.mood_board.palette?.length > 0 || concept.mood_board.links?.length > 0) && (
            <>
              <div className="cc-mb-divider" />
              <div className="cc-mb">
                <div className="cc-mb-header">
                  <span style={{ fontSize: 22 }}>🎨</span>
                  <h2 className="cc-mb-title">Konsept Kılavuzu</h2>
                </div>

                {concept.mood_board.images?.length > 0 && (
                  <div className="cc-mb-images">
                    {concept.mood_board.images.map((url: string, i: number) => (
                      <div key={i} className="cc-mb-img">
                        <img src={url} alt={`İlham görseli ${i + 1}`} />
                      </div>
                    ))}
                  </div>
                )}

                {concept.mood_board.palette?.length > 0 && (
                  <div className="cc-mb-palette-row">
                    <span className="cc-mb-palette-label">Renk Paleti</span>
                    {concept.mood_board.palette.map((color: string, i: number) => (
                      <div key={i} className="cc-mb-swatch" style={{ background: color }} title={color}>
                        <span className="cc-mb-swatch-tip">{color}</span>
                      </div>
                    ))}
                  </div>
                )}

                {concept.mood_board.links?.length > 0 && (
                  <div>
                    <p className="cc-mb-links-label">İlham Kaynakları</p>
                    <div className="cc-mb-links">
                      {concept.mood_board.links.map((link: { title: string; url: string }, i: number) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="cc-mb-link">
                          <span className="cc-mb-link-icon">🔗</span>
                          <span className="cc-mb-link-text">{link.title}</span>
                          <span className="cc-mb-link-arrow">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )
        )}

        <div className="cc-layout">
          {/* PAYLAŞIMLAR */}
          <div>
            <h2 className="cc-section-title">
              {isEnded ? 'Tüm Paylaşımlar' : 'En Beğenilen Paylaşımlar'}
            </h2>

            {posts && posts.length > 0 ? (
              <div className="cc-posts-grid">
                {posts.map((post: any) => (
                  <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                    {post.image_url
                      ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                        ? <video src={post.image_url} muted playsInline className="cc-post-img" />
                        : <img src={post.image_url} alt={post.title} className="cc-post-img" />
                      : <div className="cc-post-placeholder">🎨</div>
                    }
                    <div className="cc-post-info">
                      <div className="cc-post-meta">
                        <div className="cc-post-avatar">
                          {post.users?.avatar_url
                            ? <img src={post.users.avatar_url} alt="" />
                            : post.users?.username?.[0]?.toUpperCase()
                          }
                        </div>
                        <span className="cc-post-username">{post.users?.username}</span>
                      </div>
                      <p className="cc-post-title">{post.title}</p>
                      <p className="cc-post-likes">❤️ {post.like_count ?? 0}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="cc-empty">Henüz paylaşım yok. İlk sen katıl!</div>
            )}
          </div>

          {/* SKOR TABLOSU */}
          <div>
            <h2 className="cc-section-title">Skor Tablosu</h2>
            <div className="cc-leaderboard-card">
              {leaderboard.length === 0 ? (
                <div className="cc-empty">Henüz katılımcı yok.</div>
              ) : (
                <>
                  {/* Top 3 Podyum */}
                  {leaderboard.length >= 3 && (
                    <div className="cc-lb-top3">
                      {/* 2. */}
                      <div className="cc-podium">
                        <div className="cc-podium-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                          {leaderboard[1].avatar_url
                            ? <img src={leaderboard[1].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : leaderboard[1].username?.[0]?.toUpperCase()
                          }
                        </div>
                        <p className="cc-podium-name">{leaderboard[1].username}</p>
                        <p className="cc-podium-score">{leaderboard[1].totalLikes} ❤️</p>
                        <div className="cc-podium-bar" style={{ height: 50 }}>
                          <span style={{ fontSize: 18 }}>🥈</span>
                        </div>
                      </div>

                      {/* 1. */}
                      <div className="cc-podium">
                        <span className="cc-podium-crown">👑</span>
                        <div className="cc-podium-avatar" style={{ width: 56, height: 56, fontSize: 20, border: '2px solid #FFB547' }}>
                          {leaderboard[0].avatar_url
                            ? <img src={leaderboard[0].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : leaderboard[0].username?.[0]?.toUpperCase()
                          }
                        </div>
                        <p className="cc-podium-name">{leaderboard[0].username}</p>
                        <p className="cc-podium-score">{leaderboard[0].totalLikes} ❤️</p>
                        <div className="cc-podium-bar" style={{ height: 70 }}>
                          <span style={{ fontSize: 18 }}>🥇</span>
                        </div>
                      </div>

                      {/* 3. */}
                      <div className="cc-podium">
                        <div className="cc-podium-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
                          {leaderboard[2].avatar_url
                            ? <img src={leaderboard[2].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : leaderboard[2].username?.[0]?.toUpperCase()
                          }
                        </div>
                        <p className="cc-podium-name">{leaderboard[2].username}</p>
                        <p className="cc-podium-score">{leaderboard[2].totalLikes} ❤️</p>
                        <div className="cc-podium-bar" style={{ height: 36 }}>
                          <span style={{ fontSize: 18 }}>🥉</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="cc-lb-header" style={{ marginTop: leaderboard.length >= 3 ? 0 : 0 }}>
                    Sıralama
                  </div>

                  {leaderboard.map((entry, i) => (
                    <a key={entry.userId} href={`/profile/${entry.username}`} className="cc-lb-item">
                      <span className={`cc-lb-rank ${i === 0 ? 'cc-lb-rank-1' : i === 1 ? 'cc-lb-rank-2' : i === 2 ? 'cc-lb-rank-3' : 'cc-lb-rank-other'}`}>
                        {i + 1}
                      </span>
                      <div className="cc-lb-avatar">
                        {entry.avatar_url
                          ? <img src={entry.avatar_url} alt="" />
                          : entry.username?.[0]?.toUpperCase()
                        }
                      </div>
                      <div className="cc-lb-info">
                        <p className="cc-lb-username">{entry.username}</p>
                        <p className="cc-lb-sub">{entry.postCount} paylaşım</p>
                      </div>
                      <span className="cc-lb-score">❤️ {entry.totalLikes}</span>
                    </a>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
