import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'

async function getHashtagPosts(tag: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data } = await supabase
    .from('posts')
    .select('*, users(username, avatar_url), categories(name, icon)')
    .or(`title.ilike.%#${tag}%,description.ilike.%#${tag}%`)
    .order('created_at', { ascending: false })
    .limit(40)

  // Tam eşleşme filtresi: #tag tam kelime olmalı (sonrası harf/rakam/_ olmamalı)
  const re = new RegExp(`#${tag}(?![\\wçğıöşüÇĞİÖŞÜ])`, 'i')
  return (data ?? []).filter(
    p => re.test(p.title ?? '') || re.test(p.description ?? '')
  )
}

export async function generateMetadata(
  { params }: { params: Promise<{ tag: string }> }
): Promise<Metadata> {
  const { tag } = await params
  return {
    title: `#${tag} — Concept Corner`,
    description: `#${tag} etiketiyle yapılan paylaşımlar`,
  }
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  // Sadece güvenli karakterlere izin ver
  const safeTag = tag.replace(/[^\wçğıöşüÇĞİÖŞÜ]/gi, '')
  const posts = await getHashtagPosts(safeTag)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .ht-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        .ht-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .ht-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .ht-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); font-weight: 700; }
        .ht-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .ht-back:hover { color: var(--cc-text-primary); }

        .ht-header { max-width: 1000px; margin: 0 auto; padding: 3rem 2rem 2rem; }
        .ht-tag-label { font-size: 12px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
        .ht-tag-name { font-family: var(--cc-font-heading); font-size: 42px; font-weight: 700; color: var(--cc-accent); line-height: 1; margin-bottom: 8px; }
        .ht-count { font-size: 13px; color: var(--cc-text-muted); }

        .ht-divider { max-width: 1000px; margin: 0 auto; padding: 0 2rem; height: 1px; background: var(--cc-border); }

        .ht-grid-wrap { max-width: 1000px; margin: 0 auto; padding: 2rem 2rem 4rem; }
        .ht-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; }

        .ht-card { background: var(--cc-surface); display: block; text-decoration: none; transition: background 0.2s; }
        .ht-card:hover { background: var(--cc-surface-alt); }
        .ht-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .ht-card-placeholder { width: 100%; aspect-ratio: 4/3; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .ht-card-info { padding: 1rem 1.2rem; }
        .ht-card-cat { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .ht-card-title { font-family: var(--cc-font-heading); font-size: 15px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; margin-bottom: 8px; }
        .ht-card-meta { display: flex; align-items: center; gap: 8px; }
        .ht-card-avatar { width: 20px; height: 20px; border-radius: 50%; overflow: hidden; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; color: var(--cc-primary); flex-shrink: 0; }
        .ht-card-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ht-card-username { font-size: 12px; color: var(--cc-text-muted); }

        .ht-empty { text-align: center; padding: 5rem 2rem; }
        .ht-empty-icon { font-size: 48px; margin-bottom: 1rem; }
        .ht-empty-title { font-family: var(--cc-font-heading); font-size: 24px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .ht-empty-sub { font-size: 14px; color: var(--cc-text-muted); }

        @media (max-width: 768px) {
          .ht-nav { padding: 1rem 1.2rem; }
          .ht-header { padding: 2rem 1.5rem 1.5rem; }
          .ht-tag-name { font-size: 32px; }
          .ht-grid-wrap { padding: 1.5rem 1.5rem 3rem; }
        }
      `}</style>

      <div className="ht-page">
        <nav className="ht-nav">
          <a href="/" className="ht-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 36, width: 'auto' }} />
            <span className="ht-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="ht-back">← Akışa dön</a>
        </nav>

        <div className="ht-header">
          <p className="ht-tag-label">Hashtag</p>
          <h1 className="ht-tag-name">#{safeTag}</h1>
          <p className="ht-count">{posts.length} paylaşım</p>
        </div>

        <div className="ht-divider" />

        <div className="ht-grid-wrap">
          {posts.length === 0 ? (
            <div className="ht-empty">
              <div className="ht-empty-icon">🔍</div>
              <p className="ht-empty-title">Henüz paylaşım yok.</p>
              <p className="ht-empty-sub">#{safeTag} etiketiyle henüz bir şey paylaşılmamış.</p>
            </div>
          ) : (
            <div className="ht-grid">
              {posts.map(post => (
                <a key={post.id} href={`/post/${post.id}`} className="ht-card">
                  {post.image_url
                    ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                      ? <video src={post.image_url} muted playsInline className="ht-card-img" />
                      : <img src={post.image_url} alt={post.title} className="ht-card-img" />
                    : <div className="ht-card-placeholder">{post.categories?.icon ?? '🎨'}</div>
                  }
                  <div className="ht-card-info">
                    {post.categories && (
                      <p className="ht-card-cat">{post.categories.icon} {post.categories.name}</p>
                    )}
                    <p className="ht-card-title">{post.title}</p>
                    <div className="ht-card-meta">
                      <div className="ht-card-avatar">
                        {post.users?.avatar_url
                          ? <img src={post.users.avatar_url} alt="" />
                          : post.users?.username?.[0]?.toUpperCase()
                        }
                      </div>
                      <span className="ht-card-username">{post.users?.username}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
