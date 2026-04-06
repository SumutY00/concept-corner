import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import FollowButton from './FollowButton'
import BlockButton from './BlockButton'
import MessageButton from './MessageButton'
import VideoCard from './VideoCard'

async function getProfileData(username: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) return null

  const { data: posts } = await supabase
    .from('posts')
    .select('*, categories(name, icon)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const { data: badges } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', profile.id)
    .order('awarded_at', { ascending: false })

  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id)

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id)

  let isFollowing = false
  let isBlocked = false
  let initialRequestStatus: 'none' | 'pending' | 'accepted' = 'none'
  let bookmarkedPosts: any[] = []

  if (currentUser) {
    const { data: followData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id)
      .single()
    isFollowing = !!followData

    const { data: blockData } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', currentUser.id)
      .eq('blocked_id', profile.id)
      .single()
    isBlocked = !!blockData

    // Takip isteği durumu
    if (!isFollowing && currentUser.id !== profile.id) {
      const { data: reqData } = await supabase
        .from('follow_requests')
        .select('status')
        .eq('requester_id', currentUser.id)
        .eq('target_id', profile.id)
        .maybeSingle()
      if (reqData?.status === 'pending') initialRequestStatus = 'pending'
      else if (reqData?.status === 'accepted') initialRequestStatus = 'accepted'
    }

    // Kaydedilenler — sadece kendi profilinde göster
    if (currentUser.id === profile.id) {
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('*, posts(*, categories(name, icon))')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
      bookmarkedPosts = bookmarks?.map(b => b.posts).filter(Boolean) ?? []
    }
  }

  // Toplam beğeni (tüm postların like_count toplamı)
  const totalLikes = posts?.reduce((sum, p) => sum + (p.like_count ?? 0), 0) ?? 0

  // Profil görüntülenme kaydı — başka birisinin profili ise
  if (currentUser && currentUser.id !== profile.id) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('profile_views')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('viewer_id', currentUser.id)
      .gte('viewed_at', oneHourAgo)
      .limit(1)
      .maybeSingle()

    if (!recent) {
      await supabase.from('profile_views').insert({
        profile_id: profile.id,
        viewer_id: currentUser.id,
      })
      await supabase.rpc('increment_profile_view_count', { user_id: profile.id })
        .then(({ error }) => {
          // RPC yoksa manuel güncelle
          if (error) {
            supabase.from('users')
              .update({ profile_view_count: (profile.profile_view_count ?? 0) + 1 })
              .eq('id', profile.id)
          }
        })
    }
  } else if (!currentUser) {
    // Giriş yapmamış ziyaretçi
    const { data: recent } = await supabase
      .from('profile_views')
      .select('id')
      .eq('profile_id', profile.id)
      .is('viewer_id', null)
      .gte('viewed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle()

    if (!recent) {
      await supabase.from('profile_views').insert({ profile_id: profile.id, viewer_id: null })
    }
  }

  return { profile, posts, badges, bookmarkedPosts, followersCount, followingCount, isFollowing, isBlocked, initialRequestStatus, currentUser, totalLikes }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await getProfileData(username)
  if (!data) notFound()

  const { profile, posts, badges, bookmarkedPosts, followersCount, followingCount, isFollowing, isBlocked, initialRequestStatus, currentUser, totalLikes } = data
  const isOwnProfile = currentUser?.id === profile.id
  const isPrivate = profile.is_private ?? false
  const canViewPosts = isOwnProfile || !isPrivate || isFollowing

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); position: relative; overflow-x: hidden; }

        .cc-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-nav-btn { font-size: 13px; font-weight: 500; color: #fff; background: var(--cc-primary); text-decoration: none; padding: 7px 18px; border-radius: var(--cc-radius-sm); transition: background 0.2s; }
        .cc-nav-btn:hover { background: var(--cc-primary-hover); }

        .cc-profile-header { max-width: 900px; margin: 0 auto; padding: 4rem 2rem 2rem; display: flex; gap: 2.5rem; align-items: flex-start; }

        .cc-avatar { width: 88px; height: 88px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-family: var(--cc-font-heading); font-size: 32px; font-weight: 700; color: var(--cc-primary); flex-shrink: 0; overflow: hidden; border: 2px solid var(--cc-border); }
        .cc-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cc-profile-info { flex: 1; }

        .cc-username { font-family: var(--cc-font-heading); font-size: 28px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 6px; }
        .cc-bio { font-size: 14px; color: var(--cc-text-secondary); font-weight: 300; line-height: 1.6; margin-bottom: 1.2rem; max-width: 480px; }

        .cc-stats { display: flex; gap: 2rem; margin-bottom: 1.5rem; }
        .cc-stat { display: flex; flex-direction: column; gap: 2px; }
        .cc-stat-num { font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-stat-label { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

        .cc-edit-btn { padding: 9px 24px; border-radius: var(--cc-radius-sm); font-size: 14px; font-family: var(--cc-font-body); font-weight: 500; color: var(--cc-text-secondary); cursor: pointer; background: var(--cc-surface); border: 1px solid var(--cc-border); text-decoration: none; transition: all 0.2s; display: inline-block; }
        .cc-edit-btn:hover { color: var(--cc-text-primary); border-color: var(--cc-text-muted); }

        .cc-divider { max-width: 900px; margin: 0 auto; padding: 0 2rem; height: 1px; background: var(--cc-border); }

        /* ROZETLER */
        .cc-badges-section { max-width: 900px; margin: 0 auto; padding: 1.5rem 2rem 0; }
        .cc-section-label { font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
        .cc-badges-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .cc-badge-card { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 12px 16px; min-width: 80px; text-align: center; transition: border-color 0.2s; }
        .cc-badge-card:hover { border-color: var(--cc-primary); }
        .cc-badge-name { font-size: 11px; color: var(--cc-primary); font-weight: 500; letter-spacing: 0.04em; }
        .cc-badge-rank { font-size: 10px; color: var(--cc-text-muted); }

        /* SEKMELER */
        .cc-tabs { max-width: 900px; margin: 0 auto; padding: 0 2rem; display: flex; gap: 0; border-bottom: 1px solid var(--cc-border); margin-top: 1.5rem; }
        .cc-tab { padding: 12px 20px; font-size: 14px; font-weight: 500; color: var(--cc-text-muted); text-decoration: none; border-bottom: 2px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .cc-tab:hover { color: var(--cc-text-primary); }
        .cc-tab.active { color: var(--cc-primary); border-bottom-color: var(--cc-primary); }
        .cc-tab-count { font-size: 12px; background: var(--cc-surface-alt); color: var(--cc-text-muted); padding: 1px 7px; border-radius: 20px; }

        /* GRID */
        .cc-posts-section { max-width: 900px; margin: 0 auto; padding: 2rem 2rem 4rem; }

        .cc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; }

        .cc-post-card { background: var(--cc-surface); transition: background 0.2s; cursor: pointer; text-decoration: none; display: block; }
        .cc-post-card:hover { background: var(--cc-surface-alt); }

        .cc-post-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .cc-post-img-placeholder { width: 100%; aspect-ratio: 4/3; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 28px; }

        .cc-post-info { padding: 1rem 1.2rem; }
        .cc-post-cat { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 15px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; }
        .cc-post-counts { display: flex; gap: 10px; margin-top: 6px; }
        .cc-post-count { font-size: 11px; color: var(--cc-text-muted); display: flex; align-items: center; gap: 3px; }

        /* Analytics kartları */
        .cc-analytics { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.5rem; }
        .cc-analytics-card { display: flex; align-items: center; gap: 8px; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); padding: 8px 14px; }
        .cc-analytics-icon { font-size: 14px; line-height: 1; }
        .cc-analytics-val { font-family: var(--cc-font-heading); font-size: 15px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-analytics-label { font-size: 10px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }

        .cc-empty { text-align: center; padding: 4rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }
        .cc-new-post-btn { display: inline-block; margin-top: 1.2rem; padding: 10px 24px; background: var(--cc-primary); color: #fff; border-radius: var(--cc-radius-sm); font-size: 14px; font-weight: 500; text-decoration: none; transition: background 0.2s; }
        .cc-new-post-btn:hover { background: var(--cc-primary-hover); }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-profile-header { flex-direction: column; gap: 1.5rem; padding: 2.5rem 1.5rem 2rem; }
          .cc-posts-section { padding: 2rem 1.5rem; }
        }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="var(--cc-surface-alt)"/>
              <circle cx="14" cy="14" r="5" fill="var(--cc-primary)"/>
              <circle cx="24" cy="12" r="3.5" fill="var(--cc-accent)"/>
              <circle cx="22" cy="23" r="4" fill="var(--cc-like)"/>
              <circle cx="13" cy="23" r="2.5" fill="var(--cc-success)"/>
            </svg>
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentUser ? (
              <a href="/post/new" className="cc-nav-btn">+ Paylaş</a>
            ) : (
              <a href="/auth/login" className="cc-nav-btn">Giriş Yap</a>
            )}
          </div>
        </nav>

        {/* Profil başlığı */}
        <div className="cc-profile-header">
          <div className="cc-avatar">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} />
              : profile.username?.[0]?.toUpperCase()
            }
          </div>

          <div className="cc-profile-info">
            <h1 className="cc-username">{profile.username}</h1>
            {profile.bio && <p className="cc-bio">{profile.bio}</p>}

            <div className="cc-stats">
              <div className="cc-stat">
                <span className="cc-stat-num">{posts?.length ?? 0}</span>
                <span className="cc-stat-label">Konsept</span>
              </div>
              <div className="cc-stat">
                <span className="cc-stat-num">{followersCount ?? 0}</span>
                <span className="cc-stat-label">Takipçi</span>
              </div>
              <div className="cc-stat">
                <span className="cc-stat-num">{followingCount ?? 0}</span>
                <span className="cc-stat-label">Takip</span>
              </div>
            </div>

            {isOwnProfile && (
              <div className="cc-analytics">
                <div className="cc-analytics-card">
                  <span className="cc-analytics-icon">👁</span>
                  <div>
                    <div className="cc-analytics-val">{(profile.profile_view_count ?? 0).toLocaleString('tr-TR')}</div>
                    <div className="cc-analytics-label">Profil Görüntülenme</div>
                  </div>
                </div>
                <div className="cc-analytics-card">
                  <span className="cc-analytics-icon">❤️</span>
                  <div>
                    <div className="cc-analytics-val">{totalLikes.toLocaleString('tr-TR')}</div>
                    <div className="cc-analytics-label">Toplam Beğeni</div>
                  </div>
                </div>
                <div className="cc-analytics-card">
                  <span className="cc-analytics-icon">📸</span>
                  <div>
                    <div className="cc-analytics-val">{(posts?.length ?? 0).toLocaleString('tr-TR')}</div>
                    <div className="cc-analytics-label">Toplam Gönderi</div>
                  </div>
                </div>
                <div className="cc-analytics-card">
                  <span className="cc-analytics-icon">🎯</span>
                  <div>
                    <div className="cc-analytics-val">{(profile.total_post_views ?? 0).toLocaleString('tr-TR')}</div>
                    <div className="cc-analytics-label">Gönderi Görüntülenme</div>
                  </div>
                </div>
              </div>
            )}

            {isOwnProfile ? (
              <a href="/profile/edit" className="cc-edit-btn">Profili Düzenle</a>
            ) : currentUser ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <FollowButton followingId={profile.id} initialIsFollowing={isFollowing} isPrivate={isPrivate} initialRequestStatus={initialRequestStatus} />
                <MessageButton targetId={profile.id} isBlocked={isBlocked} />
                <BlockButton blockedId={profile.id} initialIsBlocked={isBlocked} />
              </div>
            ) : (
              <a href="/auth/login" className="cc-nav-btn" style={{ display: 'inline-block' }}>
                Takip etmek için giriş yap
              </a>
            )}
          </div>
        </div>

        {/* Rozetler */}
        {badges && badges.length > 0 && (
          <>
            <div className="cc-divider" />
            <div className="cc-badges-section">
              <p className="cc-section-label">Rozetler</p>
              <div className="cc-badges-grid">
                {badges.map((badge: any) => (
                  <div key={badge.id} className="cc-badge-card">
                    {badge.badge_image_url
                      ? <img src={badge.badge_image_url} alt={badge.concept_name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                      : <span style={{ fontSize: 36 }}>🏆</span>
                    }
                    <span className="cc-badge-name">{badge.concept_name}</span>
                    <span className="cc-badge-rank">#{badge.rank} · {badge.like_count} ❤️</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="cc-divider" style={{ marginTop: '1.5rem' }} />

        {/* Sekmeler */}
        <div className="cc-tabs">
          <a href={`/profile/${profile.username}`} className="cc-tab active">
            Konseptler
            <span className="cc-tab-count">{posts?.length ?? 0}</span>
          </a>
          {isOwnProfile && (
            <a href={`/profile/${profile.username}/saved`} className="cc-tab">
              Kaydedilenler
              <span className="cc-tab-count">{bookmarkedPosts.length}</span>
            </a>
          )}
        </div>

        {/* Konseptler */}
        <section className="cc-posts-section">
          {!canViewPosts ? (
            <div className="cc-empty">
              <p style={{ fontSize: 36, marginBottom: 12 }}>🔒</p>
              <p className="cc-empty-title">Bu hesap gizli.</p>
              <p className="cc-empty-sub">
                {currentUser
                  ? 'Bu kişinin konseptlerini görmek için takip isteği gönder.'
                  : 'Bu kişinin konseptlerini görmek için giriş yap ve takip et.'}
              </p>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="cc-grid">
              {posts.map((post) => (
                <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                  {post.image_url
                    ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                      ? <VideoCard src={post.image_url} className="cc-post-img" />
                      : <img src={post.image_url} alt={post.title} className="cc-post-img" />
                    : (
                      <div className="cc-post-img-placeholder">
                        {post.categories?.icon ?? '🎨'}
                      </div>
                    )
                  }
                  <div className="cc-post-info">
                    {post.categories && (
                      <p className="cc-post-cat">{post.categories.icon} {post.categories.name}</p>
                    )}
                    <p className="cc-post-title">{post.title}</p>
                    <div className="cc-post-counts">
                      <span className="cc-post-count">❤️ {post.like_count ?? 0}</span>
                      {(post.view_count ?? 0) > 0 && (
                        <span className="cc-post-count">👁 {post.view_count}</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="cc-empty">
              <p className="cc-empty-title">Henüz konsept yok.</p>
              {isOwnProfile && (
                <>
                  <p className="cc-empty-sub">İlk konseptini paylaşarak başla.</p>
                  <a href="/post/new" className="cc-new-post-btn">İlk konseptini paylaş</a>
                </>
              )}
            </div>
          ) }
        </section>
      </div>
    </>
  )
}
