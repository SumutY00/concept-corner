import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ThemeSwitcher from './components/ThemeSwitcher'
import NotifBell from './components/NotifBell'
import MsgBell from './components/MsgBell'
import { redirect } from 'next/navigation'

async function getHomeData() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { redirect('/auth/signup') }

  const { data: activeConcept } = await supabase
    .from('concepts')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let feedPosts: any[] = []
  let isPersonalFeed = false

  if (user) {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) ?? []

    if (followingIds.length > 0) {
      const { data } = await supabase
        .from('posts')
        .select('*, users(username, avatar_url), categories(name, icon)')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(40)
      feedPosts = data ?? []
      isPersonalFeed = true
    }
  }

  if (feedPosts.length === 0) {
    const { data } = await supabase
      .from('posts')
      .select('*, users(username, avatar_url, is_private), categories(name, icon)')
      .order('created_at', { ascending: false })
      .limit(80)
    // Gizli hesapların gönderilerini keşfet akışından çıkar
    feedPosts = (data ?? []).filter((p: any) => !p.users?.is_private).slice(0, 40)
  }

  let conceptPosts: any[] = []
  if (activeConcept) {
    const { data } = await supabase
      .from('posts')
      .select('*, users(username, avatar_url)')
      .eq('concept_id', activeConcept.id)
      .order('like_count', { ascending: false })
      .limit(6)
    conceptPosts = data ?? []
  }

  let currentUserProfile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()
    currentUserProfile = data
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  let suggestions: any[] = []
  if (user) {
    const { data: myFollows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const excludeIds = (myFollows?.map(f => f.following_id) ?? [])
    excludeIds.push(user.id)

    const { data } = await supabase
      .from('users')
      .select('id, username, avatar_url, bio')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(5)

    suggestions = data ?? []
  }

  return { feedPosts, activeConcept, conceptPosts, user, currentUserProfile, isPersonalFeed, categories, suggestions }
}

function getDaysLeft(endDate: string) {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export default async function Home() {
  const { feedPosts, activeConcept, conceptPosts, user, currentUserProfile, isPersonalFeed, categories, suggestions } = await getHomeData()
  const daysLeft = activeConcept ? getDaysLeft(activeConcept.end_date) : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-root { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); position: relative; overflow-x: hidden; transition: background 0.3s, color 0.3s; }

        .cc-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); transition: background 0.3s, border-color 0.3s; }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); letter-spacing: 0.02em; font-weight: 700; }
        .cc-nav-right { display: flex; align-items: center; gap: 10px; }
        .cc-nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: var(--cc-primary); text-decoration: none; overflow: hidden; border: 1px solid var(--cc-border); transition: border-color 0.2s; }
        .cc-nav-avatar:hover { border-color: var(--cc-primary); }
        .cc-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-nav-btn { font-size: 13px; font-weight: 600; color: #fff; background: var(--cc-gradient); text-decoration: none; padding: 8px 20px; border-radius: var(--cc-radius-sm); transition: opacity 0.2s; }
        .cc-nav-btn:hover { opacity: 0.88; }
        .cc-nav-link { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; padding: 7px 14px; border-radius: var(--cc-radius-sm); transition: color 0.2s; display: flex; align-items: center; }
        .cc-nav-link:hover { color: var(--cc-text-primary); }

        .cc-concept-banner { position: relative; z-index: 1; margin: 2rem auto; max-width: 1100px; padding: 0 2rem; }
        .cc-concept-inner { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 2rem 2.5rem; display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: center; box-shadow: var(--cc-shadow); transition: background 0.3s, border-color 0.3s; }
        .cc-concept-label { font-size: 11px; font-weight: 500; color: var(--cc-primary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .cc-concept-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cc-primary); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .cc-concept-name { font-family: var(--cc-font-heading); font-size: 36px; font-weight: 700; color: var(--cc-text-primary); line-height: 1.1; margin-bottom: 8px; }
        .cc-concept-desc { font-size: 14px; color: var(--cc-text-secondary); font-weight: 300; line-height: 1.6; margin-bottom: 10px; max-width: 560px; }
        .cc-concept-rules { font-size: 12px; color: var(--cc-primary); font-style: italic; }
        .cc-concept-timer { text-align: center; flex-shrink: 0; }
        .cc-timer-num { font-family: var(--cc-font-heading); font-size: 52px; font-weight: 700; color: var(--cc-text-primary); line-height: 1; }
        .cc-timer-label { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
        .cc-concept-join { display: inline-flex; align-items: center; gap: 6px; margin-top: 1.2rem; padding: 10px 22px; background: var(--cc-gradient); color: #fff; border-radius: var(--cc-radius-sm); font-size: 14px; font-weight: 600; text-decoration: none; transition: opacity 0.2s; }
        .cc-concept-join:hover { opacity: 0.88; }
        .cc-concept-posts { margin-top: 1.5rem; }
        .cc-concept-posts-title { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.8rem; }
        .cc-concept-posts-grid { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .cc-concept-post-thumb { width: 72px; height: 72px; border-radius: var(--cc-radius-sm); overflow: hidden; flex-shrink: 0; text-decoration: none; border: 1px solid var(--cc-border); transition: border-color 0.2s; }
        .cc-concept-post-thumb:hover { border-color: var(--cc-primary); }
        .cc-concept-post-thumb img, .cc-concept-post-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cc-concept-post-placeholder { width: 100%; height: 100%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 20px; }

        .cc-layout { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 2rem 4rem; display: grid; grid-template-columns: 1fr 280px; gap: 2.5rem; align-items: start; }
        .cc-feed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .cc-feed-title { font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-feed-sub { font-size: 12px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .cc-feed-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--cc-border); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; }
        .cc-post-card { background: var(--cc-surface); transition: background 0.2s; text-decoration: none; display: block; }
        .cc-post-card:hover { background: var(--cc-surface-alt); }
        .cc-post-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .cc-post-img-placeholder { width: 100%; aspect-ratio: 4/3; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .cc-post-info { padding: 1rem 1.2rem 1.2rem; }
        .cc-post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .cc-post-avatar { width: 22px; height: 22px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-post-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-post-username { font-size: 12px; color: var(--cc-text-muted); }
        .cc-post-cat { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 15px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; }

        .cc-sidebar { display: flex; flex-direction: column; gap: 1.5rem; }
        .cc-sidebar-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 1.4rem; box-shadow: var(--cc-shadow); transition: background 0.3s, border-color 0.3s; }
        .cc-sidebar-title { font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
        .cc-cat-list { display: flex; flex-direction: column; gap: 4px; }
        .cc-cat-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--cc-radius-sm); text-decoration: none; color: var(--cc-text-secondary); font-size: 14px; transition: all 0.2s; }
        .cc-cat-item:hover { background: var(--cc-surface-alt); color: var(--cc-text-primary); }
        .cc-cta-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 1.4rem; text-align: center; box-shadow: var(--cc-shadow); }
        .cc-cta-title { font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 6px; }
        .cc-cta-title em { font-style: italic; color: var(--cc-primary); }
        .cc-cta-sub { font-size: 13px; color: var(--cc-text-secondary); font-weight: 300; line-height: 1.6; margin-bottom: 1.2rem; }
        .cc-cta-btn { display: block; padding: 10px 20px; background: var(--cc-gradient); color: #fff; border-radius: var(--cc-radius-sm); font-size: 14px; font-weight: 600; text-decoration: none; transition: opacity 0.2s; }
        .cc-cta-btn:hover { opacity: 0.88; }
        .cc-cta-login { display: block; margin-top: 8px; font-size: 12px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-cta-login:hover { color: var(--cc-primary); }
        .cc-empty { grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 24px; color: var(--cc-text-muted); margin-bottom: 8px; }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-concept-inner { grid-template-columns: 1fr; }
          .cc-layout { grid-template-columns: 1fr; padding: 0 1.2rem 3rem; }
          .cc-sidebar { display: none; }
        }
      `}</style>

      <div className="cc-root">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <div className="cc-nav-right">
            <a href="/explore" className="cc-nav-link cc-hide-mobile">Keşfet</a>
            <a href="/search" className="cc-nav-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </a>
            <span className="cc-hide-mobile"><ThemeSwitcher /></span>
            {user && <MsgBell />}
            {user && <span className="cc-hide-mobile"><NotifBell /></span>}
            {user && currentUserProfile ? (
              <>
                <a href="/post/new" className="cc-nav-btn cc-hide-mobile">+ Paylaş</a>
                <a href={`/profile/${currentUserProfile.username}`} className="cc-nav-avatar cc-hide-mobile">
                  {currentUserProfile.avatar_url
                    ? <img src={currentUserProfile.avatar_url} alt="" />
                    : currentUserProfile.username?.[0]?.toUpperCase()
                  }
                </a>
              </>
            ) : (
              <>
                <a href="/auth/login" className="cc-nav-link">Giriş Yap</a>
                <a href="/auth/signup" className="cc-nav-btn">Kayıt Ol</a>
              </>
            )}
          </div>
        </nav>

        {activeConcept && (
          <div className="cc-concept-banner">
            <div className="cc-concept-inner">
              <div>
                <p className="cc-concept-label">
                  <span className="cc-concept-dot" />
                  Aktif Konsept
                </p>
                <a href={`/concepts/${activeConcept.id}`} style={{ textDecoration: 'none' }}>
                  <h2 className="cc-concept-name">{activeConcept.name}</h2>
                </a>
                {activeConcept.description && <p className="cc-concept-desc">{activeConcept.description}</p>}
                {activeConcept.rules && <p className="cc-concept-rules">📋 {activeConcept.rules}</p>}
                <a href="/post/new" className="cc-concept-join">Katıl →</a>

                {conceptPosts.length > 0 && (
                  <div className="cc-concept-posts">
                    <p className="cc-concept-posts-title">En beğenilen paylaşımlar</p>
                    <div className="cc-concept-posts-grid">
                      {conceptPosts.map(post => (
                        <a key={post.id} href={`/post/${post.id}`} className="cc-concept-post-thumb">
                          {post.image_url
                            ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                              ? <video src={post.image_url} muted playsInline />
                              : <img src={post.image_url} alt={post.title} />
                            : <div className="cc-concept-post-placeholder">🎨</div>
                          }
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="cc-concept-timer">
                <div className="cc-timer-num">{daysLeft}</div>
                <div className="cc-timer-label">gün kaldı</div>
              </div>
            </div>
          </div>
        )}

        <div className="cc-layout">
          <main>
            <div className="cc-feed-header">
              <h1 className="cc-feed-title">{isPersonalFeed ? 'Akışın' : 'Keşfet'}</h1>
              <span className="cc-feed-sub">{isPersonalFeed ? 'Takip ettiklerinden' : 'Son konseptler'}</span>
            </div>

            {feedPosts.length > 0 ? (
              <div className="cc-feed-grid">
                {feedPosts.map((post) => (
                  <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                    {post.image_url
                      ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                        ? <video src={post.image_url} muted playsInline className="cc-post-img" />
                        : <img src={post.image_url} alt={post.title} className="cc-post-img" />
                      : <div className="cc-post-img-placeholder">{post.categories?.icon ?? '🎨'}</div>
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
                      {post.categories && <p className="cc-post-cat">{post.categories.icon} {post.categories.name}</p>}
                      <p className="cc-post-title">{post.title}</p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>❤️ {post.like_count ?? 0}</span>
                        {(post.view_count ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>👁 {post.view_count}</span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="cc-empty">
                <p className="cc-empty-title">Henüz konsept yok.</p>
              </div>
            )}
          </main>

          <aside className="cc-sidebar">
            {!user && (
              <div className="cc-cta-card">
                <h2 className="cc-cta-title">Aramıza <em>katıl.</em></h2>
                <p className="cc-cta-sub">Konseptlerini paylaş, ilham al, yaratıcıları takip et.</p>
                <a href="/auth/signup" className="cc-cta-btn">Kayıt Ol</a>
                <a href="/auth/login" className="cc-cta-login">Zaten hesabın var mı?</a>
              </div>
            )}

            {user && currentUserProfile && (
              <div className="cc-sidebar-card">
                <p className="cc-sidebar-title">Profil</p>
                <a href={`/profile/${currentUserProfile.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                  <div className="cc-nav-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                    {currentUserProfile.avatar_url
                      ? <img src={currentUserProfile.avatar_url} alt="" />
                      : currentUserProfile.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div>
                    <p style={{ fontSize: 14, color: 'var(--cc-text-primary)', fontWeight: 500 }}>{currentUserProfile.username}</p>
                    <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>Profilini görüntüle</p>
                  </div>
                </a>
              </div>
            )}

            {user && suggestions.length > 0 && (
              <div className="cc-sidebar-card">
                <p className="cc-sidebar-title">Tanıyor olabilirsin</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map((s: any) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <a href={`/profile/${s.username}`} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--cc-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--cc-primary)', textDecoration: 'none', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--cc-border)' }}>
                        {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.username?.[0]?.toUpperCase()}
                      </a>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={`/profile/${s.username}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.username}
                        </a>
                        {s.bio && <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.bio}</p>}
                      </div>
                      <a href={`/profile/${s.username}`} style={{ fontSize: 11, color: 'var(--cc-primary)', textDecoration: 'none', fontWeight: 500, flexShrink: 0 }}>
                        Takip
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="cc-sidebar-card">
              <p className="cc-sidebar-title">Kategoriler</p>
              <div className="cc-cat-list">
                {categories?.map((cat) => (
                  <a key={cat.id} href={`/explore?category=${cat.id}`} className="cc-cat-item">
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
