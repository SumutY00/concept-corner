import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

async function getSavedPosts(username: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single()

  if (!profile || profile.id !== user.id) return null

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('*, posts(*, users(username, avatar_url), categories(name, icon))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const posts = bookmarks?.map(b => b.posts).filter(Boolean) ?? []

  return { posts, profile }
}

export default async function SavedPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await getSavedPosts(username)

  if (!data) redirect(`/profile/${username}`)

  const { posts, profile } = data

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

        .cc-container { max-width: 900px; margin: 0 auto; padding: 3rem 2rem; }

        .cc-header { margin-bottom: 2rem; }
        .cc-title { font-family: var(--cc-font-heading); font-size: 28px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 4px; }
        .cc-sub { font-size: 14px; color: var(--cc-text-muted); }

        .cc-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--cc-border); margin-bottom: 2rem; }
        .cc-tab { padding: 12px 20px; font-size: 14px; font-weight: 500; color: var(--cc-text-muted); text-decoration: none; border-bottom: 2px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .cc-tab:hover { color: var(--cc-text-primary); }
        .cc-tab.active { color: var(--cc-primary); border-bottom-color: var(--cc-primary); }
        .cc-tab-count { font-size: 12px; background: var(--cc-surface-alt); color: var(--cc-text-muted); padding: 1px 7px; border-radius: 20px; }

        .cc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; }

        .cc-post-card { background: var(--cc-surface); transition: background 0.2s; text-decoration: none; display: block; }
        .cc-post-card:hover { background: var(--cc-surface-alt); }

        .cc-post-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: var(--cc-surface-alt); }
        .cc-post-placeholder { width: 100%; aspect-ratio: 4/3; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 28px; }

        .cc-post-info { padding: 1rem 1.2rem; }
        .cc-post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .cc-post-avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-post-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-post-username { font-size: 11px; color: var(--cc-text-muted); }
        .cc-post-cat { font-size: 11px; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 14px; font-weight: 600; color: var(--cc-text-primary); line-height: 1.3; }

        .cc-empty { text-align: center; padding: 4rem 2rem; }
        .cc-empty-title { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-muted); margin-bottom: 8px; }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); }
        .cc-explore-btn { display: inline-block; margin-top: 1.2rem; padding: 10px 24px; background: var(--cc-primary); color: #fff; border-radius: var(--cc-radius-sm); font-size: 14px; font-weight: 500; text-decoration: none; transition: background 0.2s; }
        .cc-explore-btn:hover { background: var(--cc-primary-hover); }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 36, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href={`/profile/${username}`} className="cc-back">← Profile dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-header">
            <h1 className="cc-title">Kaydedilenler</h1>
            <p className="cc-sub">{profile.username} · {posts.length} kayıt</p>
          </div>

          <div className="cc-tabs">
            <a href={`/profile/${username}`} className="cc-tab">Konseptler</a>
            <a href={`/profile/${username}/saved`} className="cc-tab active">
              Kaydedilenler
              <span className="cc-tab-count">{posts.length}</span>
            </a>
          </div>

          {posts.length > 0 ? (
            <div className="cc-grid">
              {posts.map((post: any) => (
                <a key={post.id} href={`/post/${post.id}`} className="cc-post-card">
                  {post.image_url
                    ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                      ? <video src={post.image_url} muted playsInline className="cc-post-img" />
                      : <img src={post.image_url} alt={post.title} className="cc-post-img" />
                    : <div className="cc-post-placeholder">{post.categories?.icon ?? '🎨'}</div>
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
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="cc-empty">
              <p className="cc-empty-title">Henüz kayıt yok.</p>
              <p className="cc-empty-sub">Beğendiğin konseptleri kaydet, burada görünsün.</p>
              <a href="/" className="cc-explore-btn">Keşfet</a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
