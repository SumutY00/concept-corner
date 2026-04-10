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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m}dk`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}s`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}g`
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default async function Home() {
  const { feedPosts, activeConcept, conceptPosts, user, currentUserProfile, isPersonalFeed, categories, suggestions } = await getHomeData()
  const daysLeft = activeConcept ? getDaysLeft(activeConcept.end_date) : 0

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-root {
          min-height: 100vh;
          background: var(--cc-bg);
          font-family: var(--cc-font-body);
          color: var(--cc-text-primary);
          position: relative;
          overflow-x: hidden;
          transition: background 0.3s, color 0.3s;
        }

        /* ── NAVBAR ── */
        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 2.5rem;
          background: var(--cc-navbar);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--cc-border);
          transition: background 0.3s, border-color 0.3s;
          gap: 2rem;
        }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 18px; color: var(--cc-text-primary); letter-spacing: 0.02em; font-weight: 700; }
        .cc-nav-center { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .cc-nav-link {
          font-size: 13px; color: var(--cc-text-muted); text-decoration: none;
          padding: 6px 14px; border-radius: 8px; transition: color 0.2s, background 0.2s;
          display: flex; align-items: center; gap: 6px; font-weight: 500;
        }
        .cc-nav-link:hover { color: var(--cc-text-primary); background: var(--cc-surface-alt); }
        .cc-nav-link.active { color: var(--cc-primary); }
        .cc-nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .cc-nav-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--cc-surface-alt);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; color: var(--cc-primary);
          text-decoration: none; overflow: hidden;
          border: 1.5px solid var(--cc-border); transition: border-color 0.2s;
        }
        .cc-nav-avatar:hover { border-color: var(--cc-primary); }
        .cc-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-nav-btn {
          font-size: 13px; font-weight: 600; color: #fff;
          background: var(--cc-gradient); text-decoration: none;
          padding: 8px 18px; border-radius: 10px; transition: opacity 0.2s;
          white-space: nowrap;
        }
        .cc-nav-btn:hover { opacity: 0.88; }

        /* ── HERO BANNER ── */
        .cc-hero-wrap {
          max-width: 1140px; margin: 2rem auto 0; padding: 0 2rem;
        }
        .cc-hero {
          position: relative; border-radius: 20px; overflow: hidden;
          border: 1px solid rgba(102,126,234,0.25);
          background: var(--cc-surface);
          background-size: 200% 200%;
          animation: gradientShift 10s ease infinite;
          box-shadow: 0 8px 40px rgba(102,126,234,0.1);
        }
        .cc-hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%);
          pointer-events: none;
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cc-hero-inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr auto;
          gap: 3rem; align-items: center;
          padding: 2.5rem 3rem;
        }
        .cc-hero-badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 600; color: var(--cc-primary);
          text-transform: uppercase; letter-spacing: 0.1em;
          background: rgba(102,126,234,0.1);
          padding: 4px 12px; border-radius: 20px;
          border: 1px solid rgba(102,126,234,0.2);
          margin-bottom: 1rem; width: fit-content;
        }
        .cc-hero-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--cc-primary);
          animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        .cc-hero-title {
          font-family: var(--cc-font-heading); font-size: 40px; font-weight: 700;
          color: var(--cc-text-primary); line-height: 1.1; margin-bottom: 0.75rem;
        }
        .cc-hero-desc {
          font-size: 14px; color: var(--cc-text-secondary); line-height: 1.7;
          max-width: 520px; margin-bottom: 0.6rem;
        }
        .cc-hero-rules {
          font-size: 12px; color: var(--cc-primary); font-style: italic;
          margin-bottom: 1.4rem; opacity: 0.85;
        }
        .cc-hero-join {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 28px; background: var(--cc-gradient);
          color: #fff; border-radius: 12px; font-size: 15px; font-weight: 700;
          text-decoration: none; transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 6px 20px rgba(102,126,234,0.35);
        }
        .cc-hero-join:hover { opacity: 0.9; transform: translateY(-1px); }

        .cc-hero-thumbs { margin-top: 1.4rem; }
        .cc-hero-thumbs-label {
          font-size: 10px; font-weight: 600; color: var(--cc-text-muted);
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
        }
        .cc-hero-thumbs-row { display: flex; gap: 8px; }
        .cc-hero-thumb {
          width: 64px; height: 64px; border-radius: 12px; overflow: hidden;
          flex-shrink: 0; text-decoration: none;
          border: 2px solid var(--cc-border);
          transition: border-color 0.2s, transform 0.2s;
        }
        .cc-hero-thumb:hover { border-color: var(--cc-primary); transform: scale(1.05); }
        .cc-hero-thumb img, .cc-hero-thumb video { width:100%; height:100%; object-fit:cover; display:block; }
        .cc-hero-thumb-placeholder {
          width:100%; height:100%; background: var(--cc-surface-alt);
          display:flex; align-items:center; justify-content:center; font-size:22px;
        }

        /* Timer */
        .cc-hero-timer { text-align: center; flex-shrink: 0; min-width: 160px; }
        .cc-timer-num {
          font-family: var(--cc-font-heading); font-size: 88px; font-weight: 700;
          line-height: 1;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cc-timer-label {
          font-size: 12px; font-weight: 600; color: var(--cc-text-muted);
          text-transform: uppercase; letter-spacing: 0.12em; margin-top: 6px;
        }
        .cc-timer-sub {
          font-size: 11px; color: var(--cc-text-muted);
          margin-top: 4px; opacity: 0.6;
        }

        /* ── LAYOUT ── */
        .cc-layout {
          max-width: 1140px; margin: 2rem auto 0; padding: 0 2rem 6rem;
          display: grid; grid-template-columns: 1fr 300px;
          gap: 2.5rem; align-items: start;
        }

        /* ── FEED ── */
        .cc-feed-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.25rem; gap: 1rem;
        }
        .cc-feed-left { display: flex; align-items: center; gap: 10px; }
        .cc-feed-icon {
          width: 34px; height: 34px; border-radius: 10px;
          background: var(--cc-gradient);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .cc-feed-title {
          font-family: var(--cc-font-heading); font-size: 20px;
          font-weight: 700; color: var(--cc-text-primary);
        }
        .cc-feed-filters { display: flex; gap: 4px; }
        .cc-feed-filter {
          font-size: 12px; font-weight: 500; color: var(--cc-text-muted);
          padding: 5px 12px; border-radius: 20px;
          border: 1px solid var(--cc-border);
          text-decoration: none; transition: all 0.2s; cursor: pointer;
          background: transparent;
        }
        .cc-feed-filter.active {
          color: var(--cc-primary);
          border-color: rgba(102,126,234,0.4);
          background: rgba(102,126,234,0.06);
        }
        .cc-feed-filter:hover:not(.active) {
          color: var(--cc-text-primary);
          background: var(--cc-surface);
        }

        /* ── POST CARDS ── */
        .cc-feed-list { display: flex; flex-direction: column; gap: 16px; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cc-post-card {
          background: var(--cc-surface);
          border: 1px solid var(--cc-border);
          border-radius: 16px; overflow: hidden;
          text-decoration: none; display: block;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          animation: fadeInUp 0.4s ease both;
        }
        .cc-post-card:hover {
          transform: scale(1.01);
          box-shadow: 0 12px 36px rgba(0,0,0,0.18);
          border-color: rgba(102,126,234,0.3);
        }
        .cc-post-media {
          width: 100%; aspect-ratio: 16/9; overflow: hidden;
          background: var(--cc-surface-alt);
        }
        .cc-post-media img, .cc-post-media video {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform 0.4s ease;
        }
        .cc-post-card:hover .cc-post-media img,
        .cc-post-card:hover .cc-post-media video {
          transform: scale(1.03);
        }
        .cc-post-media-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          background: linear-gradient(135deg, var(--cc-surface-alt), var(--cc-surface));
        }
        .cc-post-body { padding: 1rem 1.2rem 1.2rem; }
        .cc-post-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .cc-post-user { display: flex; align-items: center; gap: 8px; }
        .cc-post-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--cc-surface-alt); overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: var(--cc-primary);
          border: 1.5px solid var(--cc-border);
        }
        .cc-post-avatar img { width:100%; height:100%; object-fit:cover; }
        .cc-post-username {
          font-size: 13px; font-weight: 600; color: var(--cc-text-primary);
        }
        .cc-post-date { font-size: 11px; color: var(--cc-text-muted); }
        .cc-post-stats { display: flex; align-items: center; gap: 10px; }
        .cc-post-stat { font-size: 12px; color: var(--cc-text-muted); display: flex; align-items: center; gap: 3px; }
        .cc-post-cat {
          font-size: 10px; color: var(--cc-primary); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          background: rgba(102,126,234,0.08); padding: 2px 8px; border-radius: 20px;
          margin-bottom: 6px; display: inline-block;
        }
        .cc-post-title {
          font-family: var(--cc-font-heading); font-size: 16px; font-weight: 700;
          color: var(--cc-text-primary); line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cc-post-desc {
          font-size: 13px; color: var(--cc-text-muted); line-height: 1.5;
          margin-top: 4px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ── EMPTY STATE ── */
        .cc-empty {
          text-align: center; padding: 5rem 2rem;
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 20px; animation: fadeInUp 0.4s ease both;
        }
        .cc-empty-emoji { font-size: 52px; margin-bottom: 1rem; }
        .cc-empty-title {
          font-family: var(--cc-font-heading); font-size: 22px; font-weight: 700;
          color: var(--cc-text-primary); margin-bottom: 8px;
        }
        .cc-empty-sub { font-size: 14px; color: var(--cc-text-muted); line-height: 1.6; margin-bottom: 1.5rem; }
        .cc-empty-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 24px; background: var(--cc-gradient);
          color: #fff; border-radius: 10px; font-size: 14px; font-weight: 600;
          text-decoration: none; transition: opacity 0.2s;
        }
        .cc-empty-btn:hover { opacity: 0.88; }

        /* ── SIDEBAR ── */
        .cc-sidebar { display: flex; flex-direction: column; gap: 16px; }

        .cc-sidebar-card {
          background: var(--cc-surface); border: 1px solid var(--cc-border);
          border-radius: 16px; padding: 1.3rem;
          box-shadow: var(--cc-shadow);
          transition: background 0.3s, border-color 0.3s;
        }
        .cc-sidebar-title {
          font-size: 11px; font-weight: 600; color: var(--cc-text-muted);
          text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }

        /* CTA card */
        .cc-cta-card {
          position: relative; border-radius: 16px; overflow: hidden;
          padding: 1.6rem 1.4rem; text-align: center;
          background: var(--cc-surface);
          border: 1px solid rgba(102,126,234,0.25);
          box-shadow: 0 0 0 1px rgba(102,126,234,0.08), var(--cc-shadow);
        }
        .cc-cta-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(135deg, rgba(102,126,234,0.06) 0%, rgba(118,75,162,0.06) 100%);
        }
        .cc-cta-content { position: relative; z-index: 1; }
        .cc-cta-emoji { font-size: 32px; margin-bottom: 0.75rem; }
        .cc-cta-title {
          font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700;
          color: var(--cc-text-primary); margin-bottom: 6px; line-height: 1.2;
        }
        .cc-cta-title em {
          font-style: italic;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cc-cta-sub {
          font-size: 13px; color: var(--cc-text-secondary); line-height: 1.6; margin-bottom: 1.2rem;
        }
        .cc-cta-btn {
          display: block; padding: 10px 20px; background: var(--cc-gradient);
          color: #fff; border-radius: 10px; font-size: 14px; font-weight: 600;
          text-decoration: none; transition: opacity 0.2s;
        }
        .cc-cta-btn:hover { opacity: 0.88; }
        .cc-cta-login {
          display: block; margin-top: 8px; font-size: 12px;
          color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s;
        }
        .cc-cta-login:hover { color: var(--cc-primary); }

        /* Profil kartı */
        .cc-profile-card {
          display: flex; align-items: center; gap: 12px; text-decoration: none;
          padding: 8px; border-radius: 12px; transition: background 0.2s;
          margin: -4px;
        }
        .cc-profile-card:hover { background: var(--cc-surface-alt); }
        .cc-profile-card-avatar {
          width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: var(--cc-surface-alt); border: 2px solid var(--cc-border);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 600; color: var(--cc-primary);
        }
        .cc-profile-card-avatar img { width:100%; height:100%; object-fit:cover; }
        .cc-profile-card-name { font-size: 14px; font-weight: 600; color: var(--cc-text-primary); }
        .cc-profile-card-sub { font-size: 12px; color: var(--cc-text-muted); margin-top: 2px; }

        /* Öneri kullanıcılar */
        .cc-suggest-list { display: flex; flex-direction: column; gap: 10px; }
        .cc-suggest-item { display: flex; align-items: center; gap: 10px; }
        .cc-suggest-avatar {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: var(--cc-surface-alt); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600; color: var(--cc-primary);
          border: 1.5px solid var(--cc-border); text-decoration: none;
          transition: border-color 0.2s;
        }
        .cc-suggest-avatar:hover { border-color: var(--cc-primary); }
        .cc-suggest-avatar img { width:100%; height:100%; object-fit:cover; }
        .cc-suggest-info { flex: 1; min-width: 0; }
        .cc-suggest-name {
          font-size: 13px; font-weight: 600; color: var(--cc-text-primary);
          text-decoration: none; display: block;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cc-suggest-name:hover { color: var(--cc-primary); }
        .cc-suggest-bio {
          font-size: 11px; color: var(--cc-text-muted);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;
        }
        .cc-suggest-btn {
          font-size: 11px; font-weight: 600; color: var(--cc-primary);
          text-decoration: none; flex-shrink: 0;
          padding: 4px 10px; border-radius: 8px;
          border: 1px solid rgba(102,126,234,0.3);
          transition: all 0.2s; white-space: nowrap;
        }
        .cc-suggest-btn:hover {
          background: rgba(102,126,234,0.1);
          border-color: rgba(102,126,234,0.5);
        }

        /* Kategoriler */
        .cc-cat-list { display: flex; flex-direction: column; gap: 2px; }
        .cc-cat-item {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 10px; border-radius: 10px;
          text-decoration: none; color: var(--cc-text-secondary);
          font-size: 13px; transition: all 0.2s; font-weight: 500;
        }
        .cc-cat-item:hover { background: var(--cc-surface-alt); color: var(--cc-text-primary); }
        .cc-cat-icon { font-size: 16px; width: 22px; text-align: center; }
        .cc-cat-arrow { margin-left: auto; font-size: 12px; color: var(--cc-text-muted); opacity: 0; transition: opacity 0.2s; }
        .cc-cat-item:hover .cc-cat-arrow { opacity: 1; }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .cc-nav { padding: 0.85rem 1.2rem; gap: 1rem; }
          .cc-nav-center { display: none; }
          .cc-hero-wrap { padding: 0 1.2rem; margin-top: 1.5rem; }
          .cc-hero-inner { grid-template-columns: 1fr; padding: 1.8rem 1.6rem; gap: 2rem; }
          .cc-hero-timer { order: -1; }
          .cc-timer-num { font-size: 64px; }
          .cc-layout { grid-template-columns: 1fr; padding: 0 1.2rem 5rem; }
          .cc-sidebar { display: none; }
          .cc-feed-filters { display: none; }
        }
      `}</style>

      <div className="cc-root">

        {/* ── NAVBAR ── */}
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="cc-logo-text cc-hide-mobile">Concept Corner</span>
          </a>

          <div className="cc-nav-center cc-hide-mobile">
            <a href="/" className="cc-nav-link active">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Ana Sayfa
            </a>
            <a href="/explore" className="cc-nav-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
              Keşfet
            </a>
            <a href="/search" className="cc-nav-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Ara
            </a>
          </div>

          <div className="cc-nav-right">
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
                <a href="/auth/login" className="cc-nav-link cc-hide-mobile">Giriş Yap</a>
                <a href="/auth/signup" className="cc-nav-btn">Kayıt Ol</a>
              </>
            )}
          </div>
        </nav>

        {/* ── HERO BANNER ── */}
        {activeConcept && (
          <div className="cc-hero-wrap">
            <div className="cc-hero">
              <div className="cc-hero-overlay" />
              <div className="cc-hero-inner">
                <div>
                  <div className="cc-hero-badge">
                    <span className="cc-hero-dot" />
                    Aktif Konsept
                  </div>
                  <a href={`/concepts/${activeConcept.id}`} style={{ textDecoration: 'none' }}>
                    <h2 className="cc-hero-title">{activeConcept.name}</h2>
                  </a>
                  {activeConcept.description && (
                    <p className="cc-hero-desc">{activeConcept.description}</p>
                  )}
                  {activeConcept.rules && (
                    <p className="cc-hero-rules">📋 {activeConcept.rules}</p>
                  )}
                  <a href="/post/new" className="cc-hero-join">
                    Katıl
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>

                  {conceptPosts.length > 0 && (
                    <div className="cc-hero-thumbs">
                      <p className="cc-hero-thumbs-label">En beğenilen paylaşımlar</p>
                      <div className="cc-hero-thumbs-row">
                        {conceptPosts.map(post => (
                          <a key={post.id} href={`/post/${post.id}`} className="cc-hero-thumb" title={post.title}>
                            {post.image_url
                              ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                                ? <video src={post.image_url} muted playsInline />
                                : <img src={post.image_url} alt={post.title} />
                              : <div className="cc-hero-thumb-placeholder">🎨</div>
                            }
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="cc-hero-timer">
                  <div className="cc-timer-num">{daysLeft}</div>
                  <div className="cc-timer-label">Gün Kaldı</div>
                  <div className="cc-timer-sub">
                    {new Date(activeConcept.end_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN LAYOUT ── */}
        <div className="cc-layout">
          <main>
            {/* Feed Header */}
            <div className="cc-feed-header">
              <div className="cc-feed-left">
                <div className="cc-feed-icon">
                  {isPersonalFeed ? '✨' : '🔥'}
                </div>
                <h1 className="cc-feed-title">{isPersonalFeed ? 'Akışın' : 'Keşfet'}</h1>
              </div>
              <div className="cc-feed-filters">
                <span className={`cc-feed-filter ${isPersonalFeed ? 'active' : ''}`}>
                  Takip Ettiklerinden
                </span>
                <span className={`cc-feed-filter ${!isPersonalFeed ? 'active' : ''}`}>
                  Keşfet
                </span>
              </div>
            </div>

            {/* Feed */}
            {feedPosts.length > 0 ? (
              <div className="cc-feed-list">
                {feedPosts.map((post, i) => (
                  <a
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="cc-post-card"
                    style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
                  >
                    <div className="cc-post-media">
                      {post.image_url
                        ? post.image_url.match(/\.(mp4|mov|webm|avi)$/i)
                          ? <video src={post.image_url} muted playsInline />
                          : <img src={post.image_url} alt={post.title} loading={i < 4 ? 'eager' : 'lazy'} />
                        : <div className="cc-post-media-placeholder">{post.categories?.icon ?? '🎨'}</div>
                      }
                    </div>
                    <div className="cc-post-body">
                      <div className="cc-post-row">
                        <div className="cc-post-user">
                          <div className="cc-post-avatar">
                            {post.users?.avatar_url
                              ? <img src={post.users.avatar_url} alt="" />
                              : post.users?.username?.[0]?.toUpperCase()
                            }
                          </div>
                          <span className="cc-post-username">{post.users?.username}</span>
                          <span className="cc-post-date">{timeAgo(post.created_at)}</span>
                        </div>
                        <div className="cc-post-stats">
                          <span className="cc-post-stat">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF5A7A' }}>
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                            {post.like_count ?? 0}
                          </span>
                          {(post.view_count ?? 0) > 0 && (
                            <span className="cc-post-stat">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              {post.view_count}
                            </span>
                          )}
                        </div>
                      </div>
                      {post.categories && (
                        <span className="cc-post-cat">{post.categories.icon} {post.categories.name}</span>
                      )}
                      <p className="cc-post-title">{post.title}</p>
                      {post.description && (
                        <p className="cc-post-desc">{post.description}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="cc-empty">
                <div className="cc-empty-emoji">🌱</div>
                <h2 className="cc-empty-title">Akışın henüz boş</h2>
                <p className="cc-empty-sub">
                  Takip ettiğin kimsenin paylaşımı yok.<br />
                  Yeni yaratıcılar keşfet ve ilham al!
                </p>
                <a href="/explore" className="cc-empty-btn">
                  Keşfet
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            )}
          </main>

          {/* ── SIDEBAR ── */}
          <aside className="cc-sidebar">

            {/* CTA — giriş yapmamış */}
            {!user && (
              <div className="cc-cta-card">
                <div className="cc-cta-glow" />
                <div className="cc-cta-content">
                  <div className="cc-cta-emoji">✦</div>
                  <h2 className="cc-cta-title">Aramıza <em>katıl.</em></h2>
                  <p className="cc-cta-sub">Konseptlerini paylaş, ilham al, yaratıcı topluluğun parçası ol.</p>
                  <a href="/auth/signup" className="cc-cta-btn">Ücretsiz Kayıt Ol</a>
                  <a href="/auth/login" className="cc-cta-login">Zaten hesabın var mı? Giriş yap →</a>
                </div>
              </div>
            )}

            {/* Profil */}
            {user && currentUserProfile && (
              <div className="cc-sidebar-card">
                <p className="cc-sidebar-title">Profilim</p>
                <a href={`/profile/${currentUserProfile.username}`} className="cc-profile-card">
                  <div className="cc-profile-card-avatar">
                    {currentUserProfile.avatar_url
                      ? <img src={currentUserProfile.avatar_url} alt="" />
                      : currentUserProfile.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div>
                    <div className="cc-profile-card-name">{currentUserProfile.username}</div>
                    <div className="cc-profile-card-sub">Profilini görüntüle →</div>
                  </div>
                </a>
              </div>
            )}

            {/* Önerilen kullanıcılar */}
            {user && suggestions.length > 0 && (
              <div className="cc-sidebar-card">
                <p className="cc-sidebar-title">Tanıyor olabilirsin</p>
                <div className="cc-suggest-list">
                  {suggestions.map((s: any) => (
                    <div key={s.id} className="cc-suggest-item">
                      <a href={`/profile/${s.username}`} className="cc-suggest-avatar">
                        {s.avatar_url
                          ? <img src={s.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : s.username?.[0]?.toUpperCase()
                        }
                      </a>
                      <div className="cc-suggest-info">
                        <a href={`/profile/${s.username}`} className="cc-suggest-name">{s.username}</a>
                        {s.bio && <p className="cc-suggest-bio">{s.bio}</p>}
                      </div>
                      <a href={`/profile/${s.username}`} className="cc-suggest-btn">Takip</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kategoriler */}
            {categories && categories.length > 0 && (
              <div className="cc-sidebar-card">
                <p className="cc-sidebar-title">Kategoriler</p>
                <div className="cc-cat-list">
                  {categories.map((cat: any) => (
                    <a key={cat.id} href={`/explore?category=${cat.id}`} className="cc-cat-item">
                      <span className="cc-cat-icon">{cat.icon}</span>
                      <span>{cat.name}</span>
                      <span className="cc-cat-arrow">›</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </aside>
        </div>
      </div>
    </>
  )
}
