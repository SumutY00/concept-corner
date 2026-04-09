'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { showToast } from '@/app/components/ToastContainer'
import MentionInput from '@/app/components/MentionInput'
import ImageSlider from '@/app/components/ImageSlider'

function buildTree(comments: any[]) {
  const map: Record<string, any> = {}
  for (const c of comments) map[c.id] = { ...c, replies: [] }
  const roots: any[] = []
  for (const c of comments) {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(map[c.id])
    else roots.push(map[c.id])
  }
  return roots
}

function renderText(text: string) {
  return text.split(/(#[\wçğıöşüÇĞİÖŞÜ]+|@\w+)/g).map((part, i) => {
    if (part.startsWith('#'))
      return <a key={i} href={`/hashtag/${part.slice(1)}`} style={{ color: 'var(--cc-accent)', textDecoration: 'none', fontWeight: 500 }}>{part}</a>
    if (part.startsWith('@'))
      return <a key={i} href={`/profile/${part.slice(1)}`} style={{ color: 'var(--cc-primary)', textDecoration: 'none', fontWeight: 500 }}>{part}</a>
    return part
  })
}

export default function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const [post, setPost] = useState<any>(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [likeLoading, setLikeLoading] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [postId, setPostId] = useState<string>('')
  const [deleting, setDeleting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { id } = await params
      setPostId(id)

      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: postData } = await supabase
        .from('posts')
        .select('*, users(id, username, avatar_url, bio), categories(name, icon)')
        .eq('id', id)
        .single()

      if (!postData) { router.push('/'); return }

      setPost(postData)
      setLikeCount(postData.like_count ?? 0)

      if (user) {
        const { data: likeData } = await supabase
          .from('likes').select('id')
          .eq('user_id', user.id).eq('post_id', id).single()
        setLiked(!!likeData)

        const { data: bookmarkData } = await supabase
          .from('bookmarks').select('id')
          .eq('user_id', user.id).eq('post_id', id).single()
        setBookmarked(!!bookmarkData)
      }

      await fetchComments(id)

      // View kaydı — 1 saatte bir tekrar sayılır
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      let alreadySeen = false

      if (user) {
        const { data: recent } = await supabase
          .from('post_views')
          .select('id')
          .eq('post_id', id)
          .eq('viewer_id', user.id)
          .gte('viewed_at', oneHourAgo)
          .limit(1)
          .maybeSingle()
        alreadySeen = !!recent
      }

      if (!alreadySeen) {
        await supabase.from('post_views').insert({
          post_id: id,
          viewer_id: user?.id ?? null,
        })
        await supabase
          .from('posts')
          .update({ view_count: (postData.view_count ?? 0) + 1 })
          .eq('id', id)
        // Gönderi sahibinin toplam_post_views cache'ini güncelle
        if (postData.users?.id) {
          await supabase.rpc('increment_total_post_views', { user_id: postData.users.id })
            .then(({ error }) => {
              if (error) {
                supabase.from('users')
                  .update({ total_post_views: (postData.users.total_post_views ?? 0) + 1 })
                  .eq('id', postData.users.id)
              }
            })
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const fetchComments = async (id: string) => {
    const { data } = await supabase
      .from('comments')
      .select('*, users!comments_user_id_fkey(username, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  const handleLike = async () => {
    if (!currentUser) { router.push('/auth/login'); return }
    setLikeLoading(true)

    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', postId)
      await supabase.rpc('update_like_count', { p_post_id: postId, p_like_count: Math.max(0, likeCount - 1) })
      setLiked(false)
      setLikeCount(prev => prev - 1)
      showToast('Beğeni kaldırıldı', 'info')
    } else {
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: postId })
      await supabase.rpc('update_like_count', { p_post_id: postId, p_like_count: likeCount + 1 })
      setLiked(true)
      setLikeCount(prev => prev + 1)
      showToast('Beğenildi')

      if (post.users?.id !== currentUser.id) {
        const { data: likePrefs } = await supabase
          .from('users').select('notification_likes').eq('id', post.users.id).single()
        if (likePrefs?.notification_likes !== false) {
          await supabase.from('notifications').insert({
            user_id: post.users.id,
            actor_id: currentUser.id,
            type: 'like',
            post_id: postId,
            message: 'gönderini beğendi',
          })
        }
      }
    }
    setLikeLoading(false)
  }

  const handleBookmark = async () => {
    if (!currentUser) { router.push('/auth/login'); return }
    setBookmarkLoading(true)

    if (bookmarked) {
      await supabase.from('bookmarks').delete()
        .eq('user_id', currentUser.id).eq('post_id', postId)
      setBookmarked(false)
      showToast('Kaydedilenlerden çıkarıldı', 'info')
    } else {
      await supabase.from('bookmarks').insert({ user_id: currentUser.id, post_id: postId })
      setBookmarked(true)
      showToast('Kaydedildi')
    }
    setBookmarkLoading(false)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    if (!currentUser) { router.push('/auth/login'); return }

    setCommentLoading(true)
    await supabase.from('comments').insert({
      post_id: postId,
      user_id: currentUser.id,
      content: newComment.trim(),
    })

    if (post.users?.id !== currentUser.id) {
      const { data: commentPrefs } = await supabase
        .from('users').select('notification_comments').eq('id', post.users.id).single()
      if (commentPrefs?.notification_comments !== false) {
        await supabase.from('notifications').insert({
          user_id: post.users.id,
          actor_id: currentUser.id,
          type: 'comment',
          post_id: postId,
          message: 'gönderine yorum yaptı',
        })
      }
    }

    // @mention bildirimleri
    const mentionedUsernames = [...new Set((newComment.match(/@(\w+)/g) ?? []).map((m: string) => m.slice(1)))]
    if (mentionedUsernames.length > 0) {
      const { data: mentionedUsers } = await supabase
        .from('users').select('id, username, notification_mentions').in('username', mentionedUsernames)
      for (const mu of mentionedUsers ?? []) {
        if (mu.id !== currentUser.id && mu.notification_mentions !== false) {
          await supabase.from('notifications').insert({
            user_id: mu.id,
            actor_id: currentUser.id,
            type: 'mention',
            post_id: postId,
            message: 'seni bir yorumda etiketledi',
          })
        }
      }
    }

    showToast('Yorum eklendi')
    setNewComment('')
    await fetchComments(postId)
    setCommentLoading(false)
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !replyTo || !currentUser) return
    setReplyLoading(true)

    await supabase.from('comments').insert({
      post_id: postId,
      user_id: currentUser.id,
      content: replyText.trim(),
      parent_id: replyTo.id,
    })

    // Yanıt bildirimi — parent yorum sahibine
    const { data: parentComment } = await supabase
      .from('comments').select('user_id').eq('id', replyTo.id).single()
    if (parentComment && parentComment.user_id !== currentUser.id) {
      const { data: replyPrefs } = await supabase
        .from('users').select('notification_comments').eq('id', parentComment.user_id).single()
      if (replyPrefs?.notification_comments !== false) {
        await supabase.from('notifications').insert({
          user_id: parentComment.user_id,
          actor_id: currentUser.id,
          type: 'reply',
          post_id: postId,
          message: 'yorumunu yanıtladı',
        })
      }
    }

    // @mention bildirimleri
    const mentionedUsernames = [...new Set((replyText.match(/@(\w+)/g) ?? []).map((m: string) => m.slice(1)))]
    if (mentionedUsernames.length > 0) {
      const { data: mentionedUsers } = await supabase
        .from('users').select('id, username, notification_mentions').in('username', mentionedUsernames)
      for (const mu of mentionedUsers ?? []) {
        if (mu.id !== currentUser.id && mu.notification_mentions !== false) {
          await supabase.from('notifications').insert({
            user_id: mu.id, actor_id: currentUser.id,
            type: 'mention', post_id: postId,
            message: 'seni bir yanıtta etiketledi',
          })
        }
      }
    }

    showToast('Yanıt eklendi')
    setReplyText('')
    setReplyTo(null)
    await fetchComments(postId)
    setReplyLoading(false)
  }

  const openEdit = () => {
    setEditTitle(post.title)
    setEditDesc(post.description ?? '')
    setEditing(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTitle.trim()) return
    setEditLoading(true)
    const { error } = await supabase
      .from('posts')
      .update({ title: editTitle.trim(), description: editDesc.trim() || null })
      .eq('id', postId)
    if (error) {
      showToast('Kaydedilemedi', 'error')
    } else {
      setPost((p: any) => ({ ...p, title: editTitle.trim(), description: editDesc.trim() || null }))
      setEditing(false)
      showToast('Değişiklikler kaydedildi')
    }
    setEditLoading(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId)
    showToast('Yorum silindi', 'info')
    await fetchComments(postId)
  }

  const handleDeletePost = async () => {
    if (!confirm('Bu konsepti silmek istediğine emin misin?')) return
    setDeleting(true)

    const allUrls: string[] = post.images?.length > 0 ? post.images : (post.image_url ? [post.image_url] : [])
    const paths = allUrls.map((u: string) => u.split('/posts/')[1]).filter(Boolean)
    if (paths.length) await supabase.storage.from('posts').remove(paths)

    await supabase.from('posts').delete().eq('id', postId)
    showToast('Konsept silindi', 'info')

    const { data: userData } = await supabase
      .from('users').select('username').eq('id', currentUser.id).single()
    router.push(`/profile/${userData?.username}`)
  }

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .skeleton {
            background: linear-gradient(90deg, var(--cc-surface) 25%, var(--cc-surface-alt) 50%, var(--cc-surface) 75%);
            background-size: 400px 100%;
            animation: shimmer 1.4s infinite;
            border-radius: 8px;
          }
        `}</style>
        <div style={{ minHeight: '100vh', background: 'var(--cc-bg)', padding: '3rem 2rem' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '3rem' }}>
            <div className="skeleton" style={{ height: 500, borderRadius: 12 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="skeleton" style={{ height: 20, width: '40%' }} />
              <div className="skeleton" style={{ height: 36, width: '80%' }} />
              <div className="skeleton" style={{ height: 36, width: '60%' }} />
              <div className="skeleton" style={{ height: 1 }} />
              <div className="skeleton" style={{ height: 44, width: 140 }} />
              <div className="skeleton" style={{ height: 1 }} />
              <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!post) return null

  const isOwner = currentUser?.id === post.user_id

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        .cc-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: var(--cc-font-heading); font-size: 22px; color: var(--cc-text-primary); font-weight: 700; }
        .cc-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: var(--cc-text-primary); }

        .cc-container { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 3rem 2rem; display: grid; grid-template-columns: 1fr 360px; gap: 3rem; align-items: start; }

        .cc-image-wrap { border-radius: var(--cc-radius); overflow: hidden; border: 1px solid var(--cc-border); background: var(--cc-surface); }
        .cc-image-wrap img { width: 100%; display: block; max-height: 600px; object-fit: cover; }
        .cc-image-wrap video { width: 100%; display: block; }
        .cc-image-placeholder { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 64px; background: var(--cc-surface-alt); }

        .cc-info { display: flex; flex-direction: column; gap: 1.2rem; }
        .cc-cat-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .cc-post-title { font-family: var(--cc-font-heading); font-size: 28px; font-weight: 700; color: var(--cc-text-primary); line-height: 1.2; }
        .cc-post-desc { font-size: 14px; color: var(--cc-text-secondary); font-weight: 300; line-height: 1.7; }
        .cc-divider { height: 1px; background: var(--cc-border); }

        .cc-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .cc-like-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); background: var(--cc-surface); cursor: pointer; transition: all 0.2s; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-secondary); }
        .cc-like-btn:hover { border-color: var(--cc-like); background: rgba(255,90,122,0.06); color: var(--cc-like); }
        .cc-like-btn.liked { border-color: var(--cc-like); background: rgba(255,90,122,0.08); color: var(--cc-like); }
        .cc-like-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-bookmark-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); background: var(--cc-surface); cursor: pointer; transition: all 0.2s; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-secondary); }
        .cc-bookmark-btn:hover { border-color: var(--cc-primary); background: rgba(79,124,255,0.06); color: var(--cc-primary); }
        .cc-bookmark-btn.saved { border-color: var(--cc-primary); background: rgba(79,124,255,0.08); color: var(--cc-primary); }
        .cc-bookmark-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-delete-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); background: var(--cc-surface); cursor: pointer; transition: all 0.2s; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-muted); margin-left: auto; }
        .cc-delete-btn:hover { border-color: var(--cc-like); color: var(--cc-like); background: rgba(255,90,122,0.06); }
        .cc-delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-edit-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); background: var(--cc-surface); cursor: pointer; transition: all 0.2s; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-muted); }
        .cc-edit-btn:hover { border-color: var(--cc-primary); color: var(--cc-primary); background: rgba(79,124,255,0.06); }
        .cc-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
        .cc-modal { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 2rem; width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 1.2rem; }
        .cc-modal-title { font-family: var(--cc-font-heading); font-size: 20px; font-weight: 700; color: var(--cc-text-primary); }
        .cc-field { display: flex; flex-direction: column; gap: 6px; }
        .cc-field label { font-size: 12px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .cc-field input, .cc-field textarea { background: var(--cc-bg); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); padding: 10px 14px; font-family: var(--cc-font-body); font-size: 14px; color: var(--cc-text-primary); outline: none; transition: border-color 0.2s; resize: vertical; }
        .cc-field input::placeholder, .cc-field textarea::placeholder { color: var(--cc-text-muted); }
        .cc-field input:focus, .cc-field textarea:focus { border-color: var(--cc-primary); }
        .cc-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
        .cc-modal-cancel { padding: 9px 20px; border-radius: var(--cc-radius-sm); border: 1px solid var(--cc-border); background: transparent; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-muted); cursor: pointer; transition: all 0.2s; }
        .cc-modal-cancel:hover { color: var(--cc-text-primary); border-color: var(--cc-text-muted); }
        .cc-modal-save { padding: 9px 22px; border-radius: var(--cc-radius-sm); border: none; background: var(--cc-primary); font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: #fff; cursor: pointer; transition: background 0.2s; }
        .cc-modal-save:hover { background: var(--cc-primary-hover); }
        .cc-modal-save:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-heart { width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.15s; }
        .cc-like-btn:hover .cc-heart, .cc-like-btn.liked .cc-heart { transform: scale(1.2); }

        .cc-author-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 1rem; text-decoration: none; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
        .cc-author-card:hover { background: var(--cc-surface-alt); }
        .cc-author-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-family: var(--cc-font-heading); font-size: 16px; font-weight: 700; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-author-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-author-name { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); margin-bottom: 2px; }
        .cc-author-sub { font-size: 12px; color: var(--cc-text-muted); }
        .cc-date { font-size: 12px; color: var(--cc-text-muted); }

        .cc-comments { display: flex; flex-direction: column; gap: 0; }
        .cc-comments-title { font-size: 11px; font-weight: 500; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
        .cc-comment-form { display: flex; gap: 8px; margin-bottom: 1.2rem; }
        .cc-comment-input { flex: 1; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); padding: 10px 14px; font-family: var(--cc-font-body); font-size: 14px; color: var(--cc-text-primary); outline: none; transition: border-color 0.2s; }
        .cc-comment-input::placeholder { color: var(--cc-text-muted); }
        .cc-comment-input:focus { border-color: var(--cc-primary); }
        .cc-comment-btn { padding: 10px 16px; background: var(--cc-primary); border: none; border-radius: var(--cc-radius-sm); font-family: var(--cc-font-body); font-size: 13px; font-weight: 500; color: #fff; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .cc-comment-btn:hover { background: var(--cc-primary-hover); }
        .cc-comment-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cc-comment-list { display: flex; flex-direction: column; gap: 2px; }
        .cc-comment-item { padding: 10px 0; border-bottom: 1px solid var(--cc-border); display: flex; gap: 10px; align-items: flex-start; }
        .cc-comment-item:last-child { border-bottom: none; }
        .cc-comment-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--cc-surface-alt); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 500; color: var(--cc-primary); overflow: hidden; flex-shrink: 0; }
        .cc-comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cc-comment-body { flex: 1; }
        .cc-comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
        .cc-comment-username { font-size: 12px; font-weight: 500; color: var(--cc-text-primary); text-decoration: none; }
        .cc-comment-username:hover { color: var(--cc-primary); }
        .cc-comment-date { font-size: 11px; color: var(--cc-text-muted); }
        .cc-comment-text { font-size: 13px; color: var(--cc-text-secondary); line-height: 1.5; }
        .cc-comment-delete { background: none; border: none; cursor: pointer; color: var(--cc-text-muted); font-size: 11px; padding: 2px 6px; border-radius: 4px; transition: color 0.2s; flex-shrink: 0; font-family: var(--cc-font-body); }
        .cc-comment-delete:hover { color: var(--cc-like); }
        .cc-comment-actions { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
        .cc-reply-btn { background: none; border: none; cursor: pointer; font-size: 11px; font-weight: 500; color: var(--cc-text-muted); padding: 0; font-family: var(--cc-font-body); transition: color 0.2s; }
        .cc-reply-btn:hover { color: var(--cc-primary); }
        .cc-reply-btn.active { color: var(--cc-primary); }
        .cc-replies { margin-left: 38px; border-left: 2px solid var(--cc-border); padding-left: 14px; display: flex; flex-direction: column; gap: 2px; }
        .cc-reply-item { padding: 8px 0; display: flex; gap: 8px; align-items: flex-start; }
        .cc-reply-form-wrap { margin: 6px 0 6px 38px; }
        .cc-reply-form { display: flex; gap: 8px; }
        .cc-reply-input { flex: 1; background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius-sm); padding: 8px 12px; font-family: var(--cc-font-body); font-size: 13px; color: var(--cc-text-primary); outline: none; transition: border-color 0.2s; }
        .cc-reply-input::placeholder { color: var(--cc-text-muted); }
        .cc-reply-input:focus { border-color: var(--cc-primary); }
        .cc-no-comments { font-size: 13px; color: var(--cc-text-muted); text-align: center; padding: 1.5rem 0; }
        .cc-login-prompt { font-size: 13px; color: var(--cc-text-secondary); text-align: center; padding: 0.8rem; background: var(--cc-surface-alt); border-radius: var(--cc-radius-sm); }
        .cc-login-prompt a { color: var(--cc-primary); text-decoration: none; }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-container { grid-template-columns: 1fr; padding: 1.5rem 1.2rem; gap: 1.5rem; }
        }
      `}</style>

      <div className="cc-page">
        <nav className="cc-nav">
          <a href="/" className="cc-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="cc-logo-text">Concept Corner</span>
          </a>
          <a href="/" className="cc-back">← Akışa dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-image-wrap">
            {(post.images?.length > 0 || post.image_url)
              ? <ImageSlider
                  images={post.images?.length > 0 ? post.images : [post.image_url]}
                  alt={post.title}
                />
              : <div className="cc-image-placeholder">{post.categories?.icon ?? '🎨'}</div>
            }
          </div>

          <div className="cc-info">
            {post.categories && (
              <span className="cc-cat-badge">{post.categories.icon} {post.categories.name}</span>
            )}

            <h1 className="cc-post-title">{renderText(post.title)}</h1>
            {post.description && <p className="cc-post-desc">{renderText(post.description)}</p>}

            <div className="cc-divider" />

            <div className="cc-actions">
              <button className={`cc-like-btn ${liked ? 'liked' : ''}`} onClick={handleLike} disabled={likeLoading}>
                <svg className="cc-heart" viewBox="0 0 24 24" fill={liked ? 'var(--cc-like)' : 'none'} stroke={liked ? 'var(--cc-like)' : 'currentColor'} strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{likeCount}</span>
              </button>

              <button className={`cc-bookmark-btn ${bookmarked ? 'saved' : ''}`} onClick={handleBookmark} disabled={bookmarkLoading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? 'var(--cc-primary)' : 'none'} stroke={bookmarked ? 'var(--cc-primary)' : 'currentColor'} strokeWidth="1.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span>{bookmarked ? 'Kaydedildi' : 'Kaydet'}</span>
              </button>

              {isOwner && (
                <>
                  <button className="cc-edit-btn" onClick={openEdit}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Düzenle
                  </button>
                  <button className="cc-delete-btn" onClick={handleDeletePost} disabled={deleting}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                    {deleting ? 'Siliniyor...' : 'Sil'}
                  </button>
                </>
              )}
            </div>

            <div className="cc-divider" />

            <a href={`/profile/${post.users?.username}`} className="cc-author-card">
              <div className="cc-author-avatar">
                {post.users?.avatar_url ? <img src={post.users.avatar_url} alt="" /> : post.users?.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="cc-author-name">{post.users?.username}</p>
                <p className="cc-author-sub">{post.users?.bio ?? 'Profili görüntüle →'}</p>
              </div>
            </a>

            <p className="cc-date">{new Date(post.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

            <div className="cc-divider" />

            <div className="cc-comments">
              <p className="cc-comments-title">{comments.length} Yorum</p>

              {currentUser ? (
                <form onSubmit={handleComment} className="cc-comment-form">
                  <MentionInput
                    value={newComment}
                    onChange={setNewComment}
                    placeholder="Yorum yaz... (@kullaniciadi ile etiketle)"
                    maxLength={500}
                    className="cc-comment-input"
                  />
                  <button type="submit" className="cc-comment-btn" disabled={commentLoading || !newComment.trim()}>
                    {commentLoading ? '...' : 'Gönder'}
                  </button>
                </form>
              ) : (
                <p className="cc-login-prompt">Yorum yapmak için <a href="/auth/login">giriş yap</a></p>
              )}

              <div className="cc-comment-list">
                {comments.length === 0 ? (
                  <p className="cc-no-comments">Henüz yorum yok. İlk yorumu sen yap!</p>
                ) : (
                  buildTree(comments).map(comment => (
                    <div key={comment.id}>
                      {/* Ana yorum */}
                      <div className="cc-comment-item">
                        <div className="cc-comment-avatar">
                          {comment.users?.avatar_url ? <img src={comment.users.avatar_url} alt="" /> : comment.users?.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="cc-comment-body">
                          <div className="cc-comment-header">
                            <a href={`/profile/${comment.users?.username}`} className="cc-comment-username">{comment.users?.username}</a>
                            <span className="cc-comment-date">{new Date(comment.created_at).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <p className="cc-comment-text">{renderText(comment.content)}</p>
                          {currentUser && (
                            <div className="cc-comment-actions">
                              <button
                                className={`cc-reply-btn${replyTo?.id === comment.id ? ' active' : ''}`}
                                onClick={() => { setReplyTo(replyTo?.id === comment.id ? null : { id: comment.id, username: comment.users?.username }); setReplyText('') }}
                              >
                                {replyTo?.id === comment.id ? 'İptal' : `Yanıtla`}
                              </button>
                              {comment.replies.length > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>{comment.replies.length} yanıt</span>
                              )}
                            </div>
                          )}
                        </div>
                        {currentUser?.id === comment.user_id && (
                          <button className="cc-comment-delete" onClick={() => handleDeleteComment(comment.id)}>sil</button>
                        )}
                      </div>

                      {/* Yanıt formu */}
                      {replyTo?.id === comment.id && (
                        <div className="cc-reply-form-wrap">
                          <form onSubmit={handleReply} className="cc-reply-form">
                            <input
                              className="cc-reply-input"
                              placeholder={`@${replyTo?.username ?? ''} kullanıcısına yanıtla...`}
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              maxLength={500}
                              autoFocus
                            />
                            <button type="submit" className="cc-comment-btn" disabled={replyLoading || !replyText.trim()}>
                              {replyLoading ? '...' : 'Gönder'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Yanıtlar */}
                      {comment.replies.length > 0 && (
                        <div className="cc-replies">
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} className="cc-reply-item">
                              <div className="cc-comment-avatar" style={{ width: 24, height: 24, fontSize: 10, flexShrink: 0 }}>
                                {reply.users?.avatar_url ? <img src={reply.users.avatar_url} alt="" /> : reply.users?.username?.[0]?.toUpperCase()}
                              </div>
                              <div className="cc-comment-body">
                                <div className="cc-comment-header">
                                  <a href={`/profile/${reply.users?.username}`} className="cc-comment-username">{reply.users?.username}</a>
                                  <span className="cc-comment-date">{new Date(reply.created_at).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <p className="cc-comment-text">{renderText(reply.content)}</p>
                              </div>
                              {currentUser?.id === reply.user_id && (
                                <button className="cc-comment-delete" onClick={() => handleDeleteComment(reply.id)}>sil</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="cc-modal-overlay" onClick={() => setEditing(false)}>
          <form className="cc-modal" onClick={e => e.stopPropagation()} onSubmit={handleSaveEdit}>
            <p className="cc-modal-title">Paylaşımı Düzenle</p>

            <div className="cc-field">
              <label htmlFor="edit-title">Başlık</label>
              <input
                id="edit-title"
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </div>

            <div className="cc-field">
              <label htmlFor="edit-desc">Açıklama</label>
              <textarea
                id="edit-desc"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="cc-modal-actions">
              <button type="button" className="cc-modal-cancel" onClick={() => setEditing(false)}>
                İptal
              </button>
              <button type="submit" className="cc-modal-save" disabled={editLoading || !editTitle.trim()}>
                {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
