import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type Tab = 'trend' | 'yeni' | 'populer' | string // string = category id

async function getExploreData(tab: Tab, search: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  // Posts query — tab'e göre sıralama
  let query = supabase
    .from('posts')
    .select('*, users(username, avatar_url, is_private), categories(name, icon)')
    .limit(60)

  // Gizli hesapları çıkar
  // (filtre join üzerinden mümkün değil, sonrasında yapılacak)

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const isCategoryTab = tab !== 'trend' && tab !== 'yeni' && tab !== 'populer'

  if (isCategoryTab) {
    query = query.eq('category_id', tab)
  }

  if (tab === 'trend') {
    query = query.order('trend_score', { ascending: false })
  } else if (tab === 'populer') {
    query = query.order('like_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data: rawPosts } = await query
  const posts = (rawPosts ?? []).filter((p: any) => !p.users?.is_private)

  // Popüler kullanıcılar — en çok takipçi
  const { data: popularUsers } = await supabase
    .from('users')
    .select('id, username, avatar_url, bio')
    .order('id') // fallback; aşağıda follows ile join yapılamıyor, ayrı çekiyoruz
    .limit(10)

  // Her kullanıcının takipçi sayısını çek
  const usersWithFollowers: any[] = []
  for (const u of popularUsers ?? []) {
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', u.id)
    usersWithFollowers.push({ ...u, followers_count: count ?? 0 })
  }
  const topUsers = usersWithFollowers
    .sort((a, b) => b.followers_count - a.followers_count)
    .slice(0, 5)

  // Trend hashtagler — description'lardan topla
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('description')
    .order('created_at', { ascending: false })
    .limit(200)

  const tagMap: Record<string, number> = {}
  for (const p of recentPosts ?? []) {
    const tags = p.description?.match(/#[\wçğıöşüÇĞİÖŞÜ]+/gi) ?? []
    for (const tag of tags) {
      const t = tag.toLowerCase()
      tagMap[t] = (tagMap[t] ?? 0) + 1
    }
  }
  const trendTags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))

  const activeCategory = isCategoryTab ? (categories?.find(c => c.id === tab) ?? null) : null

  return { posts, categories, topUsers, trendTags, activeCategory, user }
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; q?: string }>
}) {
  const params = await searchParams
  // Eski ?category= linklerini de destekle
  const rawTab = params.tab ?? (params.category ? params.category : 'trend')
  const tab: Tab = rawTab
  const search = params.q ?? ''

  const { posts, categories, topUsers, trendTags, activeCategory, user } = await getExploreData(tab, search)

  const isCategoryTab = tab !== 'trend' && tab !== 'yeni' && tab !== 'populer'

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        /* NAV */
        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2.5rem;
          background: var(--cc-navbar); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--cc-border);
        }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 20px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; display: flex; align-items: center; gap: 6px; }
        .cc-back:hover { color: var(--cc-text-primary); }

        /* CONTAINER */
        .cc-container { max-width: 1100px; margin: 0 auto; padding: 2.5rem 2rem 6rem; }

        /* SEARCH */
        .cc-search-wrap {
          position: relative; margin-bottom: 1.75rem;
        }
        .cc-search-icon {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          color: var(--cc-text-muted); pointer-events: none;
        }
        .cc-search-input {
          width: 100%; padding: 13px 16px 13px 44px;
          background: var(--cc-surface); border: 1.5px solid var(--cc-border);
          border-radius: 14px; font-family: var(--cc-font-body); font-size: 15px;
          color: var(--cc-text-primary); outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cc-search-input::placeholder { color: var(--cc-text-muted); opacity: 0.6; }
        .cc-search-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
        }

        /* TABS */
        .cc-tabs-row {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--cc-border);
          padding-bottom: 0;
        }
        .cc-tab {
          position: relative; padding: 10px 18px;
          font-size: 14px; font-weight: 600; text-decoration: none;
          color: var(--cc-text-muted); border-radius: 10px 10px 0 0;
          transition: color 0.2s, background 0.2s;
          display: flex; align-items: center; gap: 6px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .cc-tab:hover { color: var(--cc-text-primary); }
        .cc-tab.active { color: var(--cc-primary); border-bottom-color: var(--cc-primary); }
        .cc-tab-icon { font-size: 15px; }

        /* CATEGORY PILLS (altında) */
        .cc-cat-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 2rem; }
        .cc-cat-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 100px;
          font-size: 13px; font-weight: 500; text-decoration: none;
          border: 1px solid var(--cc-border); background: var(--cc-surface);
          color: var(--cc-text-secondary); transition: all 0.2s;
        }
        .cc-cat-pill:hover { border-color: var(--cc-primary); color: var(--cc-primary); }
        .cc-cat-pill.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-color: transparent; color: #fff;
        }

        /* POPULAR USERS */
        .cc-section { margin-bottom: 2.5rem; }
        .cc-section-header {
          display: flex; align-items: center; gap: 10px; margin-bottom: 1rem;
        }
        .cc-section-icon {
          width: 30px; height: 30px; border-radius: 9px;
          background: var(--cc-gradient);
          display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
        }
        .cc-section-title { font-family: var(--cc-font-heading); font-size: 17px; font-weight: 700; color: var(--cc-text-primary); }

        .cc-users-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .cc-users-scroll::-webkit-scrollbar { display: none; }

        .cc-user-card {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 16px; padding: 1.2rem 1rem; min-width: 120px; flex-shrink: 0;
          text-decoration: none; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .cc-user-card:hover { border-color: rgba(102,126,234,0.4); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(102,126,234,0.12); }
        .cc-user-avatar {
          width: 56px; height: 56px; border-radius: 50%; overflow: hidden;
          background: var(--cc-surface-alt); border: 2px solid var(--cc-border);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 700; color: var(--cc-primary);
        }
        .cc-user-avatar img { width:100%; height:100%; object-fit:cover; }
        .cc-user-name { font-size: 13px; font-weight: 600; color: var(--cc-text-primary); text-align: center; }
        .cc-user-followers { font-size: 11px; color: var(--cc-text-muted); }
        .cc-user-follow {
          font-size: 11px; font-weight: 600; color: var(--cc-primary);
          padding: 4px 12px; border-radius: 20px;
          border: 1px solid rgba(102,126,234,0.3);
          transition: all 0.2s; white-space: nowrap;
        }
        .cc-user-card:hover .cc-user-follow { background: rgba(102,126,234,0.1); }

        /* TREND TAGS */
        .cc-tags-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .cc-tag-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 14px; border-radius: 100px;
          font-size: 13px; font-weight: 500; text-decoration: none;
          background: rgba(102,126,234,0.08); border: 1px solid rgba(102,126,234,0.2);
          color: var(--cc-primary); transition: all 0.2s;
        }
        .cc-tag-pill:hover { background: rgba(102,126,234,0.16); border-color: rgba(102,126,234,0.4); }
        .cc-tag-count { font-size: 10px; color: var(--cc-text-muted); margin-left: 2px; }

        /* POST GRID */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cc-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .cc-post-card {
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 16px; overflow: hidden; text-decoration: none; display: block;
          transition: border-color 0.22s, transform 0.22s, box-shadow 0.22s;
          animation: fadeInUp 0.35s ease both;
        }
        .cc-post-card:hover {
          border-color: rgba(102,126,234,0.35);
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.15);
        }
        .cc-post-media { width: 100%; aspect-ratio: 4/3; overflow: hidden; background: var(--cc-surface-alt); }
        .cc-post-media img, .cc-post-media video {
          width:100%; height:100%; object-fit:cover; display:block;
          transition: transform 0.4s ease;
        }
        .cc-post-card:hover .cc-post-media img,
        .cc-post-card:hover .cc-post-media video { transform: scale(1.05); }
        .cc-post-placeholder {
          width:100%; height:100%; display:flex; align-items:center; justify-content:center;
          font-size:36px;
          background: linear-gradient(135deg, var(--cc-surface-alt), var(--cc-surface));
        }

        .cc-post-info { padding: 0.9rem 1rem 1rem; }
        .cc-post-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
        .cc-post-avatar {
          width: 22px; height: 22px; border-radius: 50%; background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 600; color: var(--cc-primary);
          overflow: hidden; flex-shrink: 0;
        }
        .cc-post-avatar img { width:100%; height:100%; object-fit:cover; }
        .cc-post-username { font-size: 12px; color: var(--cc-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cc-post-cat {
          font-size: 10px; color: var(--cc-primary); font-weight: 600; letter-spacing: 0.05em;
          text-transform: uppercase; display: inline-block; margin-bottom: 4px;
        }
        .cc-post-title {
          font-family: var(--cc-font-heading); font-size: 14px; font-weight: 700;
          color: var(--cc-text-primary); line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .cc-post-stats { display: flex; gap: 8px; margin-top: 6px; }
        .cc-post-stat { font-size: 11px; color: var(--cc-text-muted); display: flex; align-items: center; gap: 3px; }

        /* Trend badge */
        .cc-trend-badge {
          position: absolute; top: 8px; right: 8px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff; font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 20px; letter-spacing: 0.04em;
        }

        .cc-post-card-wrap { position: relative; display: block; }

        /* EMPTY */
        .cc-empty {
          grid-column: 1 / -1; text-align: center; padding: 5rem 2rem;
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 20px;
        }
        .cc-empty-emoji { font-size: 48px; margin-bottom: 1rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .cc-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-container { padding: 1.5rem 1.2rem 5rem; }
          .cc-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .cc-users-scroll { gap: 8px; }
          .cc-user-card { min-width: 100px; padding: 1rem 0.8rem; }
        }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Akışa dön
          </a>
        </nav>

        <div className="cc-container">

          {/* Arama */}
          <form method="GET" action="/explore" className="cc-search-wrap">
            <input type="hidden" name="tab" value={tab} />
            <span className="cc-search-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              name="q"
              type="search"
              className="cc-search-input"
              placeholder="Konsept, kullanıcı veya hashtag ara..."
              defaultValue={search}
            />
          </form>

          {/* Tab sekmeleri */}
          <div className="cc-tabs-row">
            <a href="/explore?tab=trend" className={`cc-tab ${tab === 'trend' ? 'active' : ''}`}>
              <span className="cc-tab-icon">🔥</span> Trend
            </a>
            <a href="/explore?tab=yeni" className={`cc-tab ${tab === 'yeni' ? 'active' : ''}`}>
              <span className="cc-tab-icon">✨</span> Yeni
            </a>
            <a href="/explore?tab=populer" className={`cc-tab ${tab === 'populer' ? 'active' : ''}`}>
              <span className="cc-tab-icon">⭐</span> Popüler
            </a>
            <a href={`/explore?tab=${isCategoryTab ? tab : (categories?.[0]?.id ?? 'trend')}`}
              className={`cc-tab ${isCategoryTab ? 'active' : ''}`}>
              <span className="cc-tab-icon">🗂</span> Kategori
            </a>
          </div>

          {/* Kategori pilleri — sadece kategori tabında */}
          {isCategoryTab && (
            <div className="cc-cat-pills">
              {categories?.map((cat: any) => (
                <a
                  key={cat.id}
                  href={`/explore?tab=${cat.id}`}
                  className={`cc-cat-pill ${tab === cat.id ? 'active' : ''}`}
                >
                  {cat.icon} {cat.name}
                </a>
              ))}
            </div>
          )}

          {/* Popüler Kullanıcılar — sadece trend/yeni/popüler tablarında */}
          {!isCategoryTab && topUsers.length > 0 && (
            <div className="cc-section">
              <div className="cc-section-header">
                <div className="cc-section-icon">👑</div>
                <h2 className="cc-section-title">Popüler Kullanıcılar</h2>
              </div>
              <div className="cc-users-scroll">
                {topUsers.map((u: any) => (
                  <a key={u.id} href={`/profile/${u.username}`} className="cc-user-card">
                    <div className="cc-user-avatar">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.username} />
                        : u.username?.[0]?.toUpperCase()
                      }
                    </div>
                    <span className="cc-user-name">{u.username}</span>
                    <span className="cc-user-followers">{u.followers_count} takipçi</span>
                    <span className="cc-user-follow">Takip Et</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Trend Hashtagler */}
          {!isCategoryTab && !search && trendTags.length > 0 && (
            <div className="cc-section">
              <div className="cc-section-header">
                <div className="cc-section-icon">#</div>
                <h2 className="cc-section-title">Trend Hashtagler</h2>
              </div>
              <div className="cc-tags-row">
                {trendTags.map(({ tag, count }) => (
                  <a
                    key={tag}
                    href={`/hashtag/${tag.slice(1)}`}
                    className="cc-tag-pill"
                  >
                    {tag}
                    <span className="cc-tag-count">{count}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Post Grid */}
          <div className="cc-section">
            <div className="cc-section-header">
              <div className="cc-section-icon">
                {tab === 'trend' ? '🔥' : tab === 'yeni' ? '✨' : tab === 'populer' ? '⭐' : '🗂'}
              </div>
              <h2 className="cc-section-title">
                {tab === 'trend' && 'Trend Konseptler'}
                {tab === 'yeni' && 'Yeni Paylaşımlar'}
                {tab === 'populer' && 'En Popüler'}
                {isCategoryTab && (activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'Kategori')}
              </h2>
              {posts.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--cc-text-muted)' }}>
                  {posts.length} sonuç
                </span>
              )}
            </div>

            {posts.length > 0 ? (
              <div className="cc-grid">
                {posts.map((post: any, i: number) => (
                  <div key={post.id} className="cc-post-card-wrap" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <a href={`/post/${post.id}`} className="cc-post-card">
                      <div className="cc-post-media">
                        {post.image_url
                          ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                            ? <video src={post.image_url} muted playsInline />
                            : <img src={post.image_url} alt={post.title} loading={i < 6 ? 'eager' : 'lazy'} />
                          : <div className="cc-post-placeholder">{post.categories?.icon ?? '🎨'}</div>
                        }
                      </div>
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
                        {post.categories && (
                          <span className="cc-post-cat">{post.categories.icon} {post.categories.name}</span>
                        )}
                        <p className="cc-post-title">{post.title}</p>
                        <div className="cc-post-stats">
                          <span className="cc-post-stat">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF5A7A' }}>
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            {post.like_count ?? 0}
                          </span>
                          {(post.comment_count ?? 0) > 0 && (
                            <span className="cc-post-stat">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                              {post.comment_count}
                            </span>
                          )}
                          {(post.view_count ?? 0) > 0 && (
                            <span className="cc-post-stat">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              {post.view_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                    {tab === 'trend' && i < 3 && (
                      <div className="cc-trend-badge">🔥 #{i + 1}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="cc-grid">
                <div className="cc-empty">
                  <div className="cc-empty-emoji">🔍</div>
                  <h2 className="cc-empty-title">
                    {search ? `"${search}" için sonuç bulunamadı` : 'Henüz paylaşım yok'}
                  </h2>
                  <p className="cc-empty-sub">İlk paylaşımı sen yapabilirsin!</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
