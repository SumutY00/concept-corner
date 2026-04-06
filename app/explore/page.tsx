import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getExploreData(categoryId?: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  let query = supabase
    .from('posts')
    .select('*, users(username, avatar_url), categories(name, icon)')
    .order('like_count', { ascending: false })
    .limit(40)

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data: posts } = await query

  const activeCategory = categories?.find(c => c.id === categoryId) ?? null

  return { posts, categories, activeCategory }
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const { posts, categories, activeCategory } = await getExploreData(category)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        .cc-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: var(--cc-text-primary); }

        .cc-container { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem; }

        .cc-header { margin-bottom: 2rem; }
        .cc-title { font-family: var(--cc-font-heading); font-size: 32px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 4px; }
        .cc-subtitle { font-size: 14px; color: var(--cc-text-muted); }

        /* Kategori filtreleri */
        .cc-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 2.5rem; }

        .cc-filter-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 100px;
          font-size: 13px; font-weight: 500;
          text-decoration: none; transition: all 0.2s;
          border: 1px solid var(--cc-border);
          background: var(--cc-surface);
          color: var(--cc-text-secondary);
        }
        .cc-filter-btn:hover { border-color: var(--cc-primary); color: var(--cc-primary); }
        .cc-filter-btn.active { background: var(--cc-primary); border-color: var(--cc-primary); color: #fff; }

        /* Grid */
        .cc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1px;
          border: 1px solid var(--cc-border);
          border-radius: var(--cc-radius);
          overflow: hidden;
        }

        .cc-post-card { background: var(--cc-surface); text-decoration: none; display: block; transition: background 0.2s; }
        .cc-post-card:hover { background: var(--cc-surface-alt); }

        .cc-post-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .cc-post-placeholder { width: 100%; aspect-ratio: 4/3; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 36px; }

        .cc-post-info { padding: 1rem 1.2rem; }
        .cc-post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .cc-post-avatar { width: 22px; height: 22px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-post-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-post-username { font-size: 12px; color: var(--cc-text-muted); }
        .cc-post-cat { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 15px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; }
        .cc-post-likes { font-size: 11px; color: var(--cc-text-muted); margin-top: 4px; }

        .cc-empty { text-align: center; padding: 5rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 24px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-container { padding: 2rem 1.2rem; }
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
          <a href="/" className="cc-back">← Akışa dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-header">
            <h1 className="cc-title">
              {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'Keşfet'}
            </h1>
            <p className="cc-subtitle">
              {activeCategory
                ? `${posts?.length ?? 0} paylaşım`
                : 'Tüm kategorilerdeki konseptler'
              }
            </p>
          </div>

          {/* Kategori filtreleri */}
          <div className="cc-filters">
            <a
              href="/explore"
              className={`cc-filter-btn ${!category ? 'active' : ''}`}
            >
              Tümü
            </a>
            {categories?.map(cat => (
              <a
                key={cat.id}
                href={`/explore?category=${cat.id}`}
                className={`cc-filter-btn ${category === cat.id ? 'active' : ''}`}
              >
                {cat.icon} {cat.name}
              </a>
            ))}
          </div>

          {/* Paylaşımlar */}
          {posts && posts.length > 0 ? (
            <div className="cc-grid">
              {posts.map((post: any) => (
                <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                  {post.image_url
                    ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                      ? <video src={post.image_url} muted playsInline className="cc-post-img" />
                      : <img src={post.image_url} alt={post.title} className="cc-post-img" />
                    : (
                      <div className="cc-post-placeholder">
                        {post.categories?.icon ?? '🎨'}
                      </div>
                    )
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
                    {post.categories && (
                      <p className="cc-post-cat">{post.categories.icon} {post.categories.name}</p>
                    )}
                    <p className="cc-post-title">{post.title}</p>
                    <p className="cc-post-likes">❤️ {post.like_count ?? 0}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="cc-empty">
              <p className="cc-empty-title">
                {activeCategory ? 'Bu kategoride henüz paylaşım yok.' : 'Henüz paylaşım yok.'}
              </p>
              <p className="cc-empty-sub">İlk paylaşımı sen yap!</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
