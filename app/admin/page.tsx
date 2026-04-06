'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [concepts, setConcepts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [distributingId, setDistributingId] = useState<string | null>(null)
  const [badgeResults, setBadgeResults] = useState<Record<string, any>>({})
  const [form, setForm] = useState({
    name: '',
    description: '',
    rules: '',
    start_date: '',
    end_date: '',
    status: 'upcoming',
    badge_name: '',
  })
  const [badgeImageFile, setBadgeImageFile] = useState<File | null>(null)
  const [badgeImagePreview, setBadgeImagePreview] = useState<string | null>(null)

  // Mood board editor
  const [mbConceptId, setMbConceptId] = useState<string | null>(null)
  const [mbData, setMbData] = useState<{ images: string[]; palette: string[]; links: { title: string; url: string }[] }>({ images: [], palette: [], links: [] })
  const [mbSaving, setMbSaving] = useState(false)
  const [mbImageInput, setMbImageInput] = useState('')
  const [mbColorInput, setMbColorInput] = useState('#c8865c')
  const [mbLinkTitle, setMbLinkTitle] = useState('')
  const [mbLinkUrl, setMbLinkUrl] = useState('')
  const [mbImageUploading, setMbImageUploading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      await fetchConcepts()
      setLoading(false)
    }
    load()
  }, [])

  const fetchConcepts = async () => {
    const { data } = await supabase
      .from('concepts')
      .select('*')
      .order('created_at', { ascending: false })
    setConcepts(data ?? [])
  }

  const handleBadgeImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBadgeImageFile(file)
    setBadgeImagePreview(URL.createObjectURL(file))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let badgeImageUrl = null

    if (badgeImageFile) {
      const fileExt = badgeImageFile.name.split('.').pop()
      const filePath = `badges/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, badgeImageFile)

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filePath)
        badgeImageUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('concepts').insert({
      ...form,
      badge_image_url: badgeImageUrl,
      created_by: user.id,
    })

    if (error) {
      setMessage('Hata: ' + error.message)
      setIsSuccess(false)
    } else {
      setIsSuccess(true)
      setMessage('Konsept oluşturuldu!')
      setShowForm(false)
      setForm({ name: '', description: '', rules: '', start_date: '', end_date: '', status: 'upcoming', badge_name: '' })
      setBadgeImageFile(null)
      setBadgeImagePreview(null)
      await fetchConcepts()
    }
    setSaving(false)
  }

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('concepts').update({ status }).eq('id', id)
    await fetchConcepts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu konsepti silmek istediğine emin misin?')) return
    await supabase.from('concepts').delete().eq('id', id)
    await fetchConcepts()
  }

  const handleDistributeBadges = async (concept: any) => {
    if (!confirm(`"${concept.name}" konsepti için rozetler dağıtılacak. Emin misin?`)) return

    setDistributingId(concept.id)
    setMessage('')

    // Konsepte katılan benzersiz kullanıcıları ve toplam beğenilerini al
    const { data: posts } = await supabase
      .from('posts')
      .select('user_id, like_count, users(username)')
      .eq('concept_id', concept.id)

    if (!posts || posts.length === 0) {
      setMessage('Bu konsepte hiç paylaşım yapılmamış.')
      setIsSuccess(false)
      setDistributingId(null)
      return
    }

    // Kullanıcı başına toplam beğeniyi hesapla
    const userLikes: Record<string, { userId: string; username: string; totalLikes: number }> = {}

    posts.forEach((post: any) => {
      if (!userLikes[post.user_id]) {
        userLikes[post.user_id] = {
          userId: post.user_id,
          username: post.users?.username ?? '',
          totalLikes: 0,
        }
      }
      userLikes[post.user_id].totalLikes += post.like_count ?? 0
    })

    // Sırala
    const sorted = Object.values(userLikes).sort((a, b) => b.totalLikes - a.totalLikes)
    const totalParticipants = sorted.length

    // %5 hesapla (en az 1)
    const topPercent = Math.max(1, Math.floor(totalParticipants * 0.05))

    // Eşitlik kontrolü: topPercent'teki kişinin like sayısını bul
    const cutoffLikes = sorted[topPercent - 1]?.totalLikes ?? 0

    // Cutoff like sayısına eşit veya üstü olan herkes rozet alır
    const winners = sorted.filter(u => u.totalLikes >= cutoffLikes)

    // Rozet dağıt
    let awarded = 0
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i]
      const { error } = await supabase.from('badges').upsert({
        user_id: winner.userId,
        concept_id: concept.id,
        concept_name: concept.name,
        badge_image_url: concept.badge_image_url,
        like_count: winner.totalLikes,
        rank: i + 1,
        awarded_at: new Date().toISOString(),
      }, { onConflict: 'user_id,concept_id' })

      if (!error) awarded++
    }

    setBadgeResults(prev => ({
      ...prev,
      [concept.id]: {
        total: totalParticipants,
        threshold: topPercent,
        awarded,
        cutoffLikes,
        winners: winners.slice(0, 10),
      }
    }))

    setIsSuccess(true)
    setMessage(`${awarded} kişiye rozet verildi! (${totalParticipants} katılımcının %5'i)`)
    setDistributingId(null)
  }

  const openMoodBoard = (concept: any) => {
    const mb = concept.mood_board ?? {}
    setMbData({
      images: mb.images ?? [],
      palette: mb.palette ?? [],
      links: mb.links ?? [],
    })
    setMbConceptId(concept.id)
    setMbImageInput('')
    setMbColorInput('#c8865c')
    setMbLinkTitle('')
    setMbLinkUrl('')
  }

  const handleMbImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMbImageUploading(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `moodboard/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
    const { error } = await supabase.storage.from('posts').upload(filePath, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filePath)
      setMbData(d => ({ ...d, images: [...d.images, urlData.publicUrl].slice(0, 8) }))
    }
    setMbImageUploading(false)
    e.target.value = ''
  }

  const handleSaveMoodBoard = async () => {
    if (!mbConceptId) return
    setMbSaving(true)
    await supabase.from('concepts').update({ mood_board: mbData }).eq('id', mbConceptId)
    await fetchConcepts()
    setMbSaving(false)
    setMbConceptId(null)
    setIsSuccess(true)
    setMessage('Mood board kaydedildi!')
  }

  const statusColor: Record<string, string> = {
    active: 'rgba(80,160,90,0.15)',
    upcoming: 'rgba(200,134,92,0.15)',
    ended: 'rgba(100,100,100,0.15)',
  }
  const statusTextColor: Record<string, string> = {
    active: '#7ec88a',
    upcoming: '#c8865c',
    ended: '#524840',
  }
  const statusLabel: Record<string, string> = {
    active: 'Aktif',
    upcoming: 'Yakında',
    ended: 'Tamamlandı',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0e0c0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(200,134,92,0.3)', borderTopColor: '#c8865c', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page { min-height: 100vh; background: #0e0c0a; font-family: 'DM Sans', sans-serif; color: #f0ebe3; }
        .cc-nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(14,12,10,0.9); position: sticky; top: 0; z-index: 100; }
        .cc-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .cc-logo-text { font-family: 'Playfair Display', serif; font-size: 18px; color: #f0ebe3; }
        .cc-back { font-size: 13px; color: #6a6050; text-decoration: none; transition: color 0.2s; }
        .cc-back:hover { color: #f0ebe3; }
        .cc-container { max-width: 900px; margin: 0 auto; padding: 3rem 2rem; }
        .cc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
        .cc-title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #f0ebe3; }
        .cc-title em { font-style: italic; color: #c8865c; }

        .cc-btn-primary { padding: 10px 22px; background: #c8865c; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; color: #1a120a; cursor: pointer; transition: background 0.2s; }
        .cc-btn-primary:hover { background: #d99a72; }
        .cc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-form-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(200,134,92,0.2); border-radius: 12px; padding: 1.8rem; margin-bottom: 2rem; }
        .cc-form-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #f0ebe3; margin-bottom: 1.5rem; }
        .cc-label { display: block; font-size: 11px; font-weight: 500; color: #6a6050; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 7px; }
        .cc-input, .cc-textarea, .cc-select { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 11px 14px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #f0ebe3; outline: none; transition: border-color 0.2s; }
        .cc-input:focus, .cc-textarea:focus, .cc-select:focus { border-color: rgba(200,134,92,0.5); }
        .cc-input::placeholder, .cc-textarea::placeholder { color: #3a342c; }
        .cc-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
        .cc-select option { background: #1a140e; }
        .cc-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .cc-field { margin-bottom: 1rem; }
        .cc-form-actions { display: flex; gap: 10px; margin-top: 1.2rem; }
        .cc-btn-cancel { padding: 10px 22px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #7a7060; cursor: pointer; transition: all 0.2s; }
        .cc-btn-cancel:hover { color: #f0ebe3; }

        /* Badge image upload */
        .cc-badge-upload { display: flex; align-items: center; gap: 1rem; }
        .cc-badge-preview { width: 60px; height: 60px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .cc-badge-preview img { width: 100%; height: 100%; object-fit: cover; }
        .cc-upload-label { padding: 8px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-size: 13px; color: #7a7060; cursor: pointer; transition: all 0.2s; }
        .cc-upload-label:hover { color: #f0ebe3; }

        /* Concept cards */
        .cc-concept-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.4rem; margin-bottom: 1rem; }
        .cc-concept-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
        .cc-concept-left { display: flex; align-items: center; gap: 12px; }
        .cc-concept-badge-thumb { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .cc-concept-badge-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .cc-concept-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #f0ebe3; }
        .cc-status-badge { font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.06em; text-transform: uppercase; }
        .cc-concept-desc { font-size: 13px; color: #7a7060; line-height: 1.6; margin-bottom: 8px; }
        .cc-concept-rules { font-size: 12px; color: #524840; line-height: 1.5; margin-bottom: 12px; font-style: italic; }
        .cc-concept-meta { display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 12px; color: #524840; }
        .cc-concept-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .cc-action-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #7a7060; font-family: 'DM Sans', sans-serif; }
        .cc-action-btn:hover { background: rgba(255,255,255,0.08); color: #f0ebe3; }
        .cc-action-btn.active { background: rgba(80,160,90,0.1); border-color: rgba(80,160,90,0.3); color: #7ec88a; }
        .cc-action-btn.badge { background: rgba(200,134,92,0.1); border-color: rgba(200,134,92,0.3); color: #c8865c; }
        .cc-action-btn.badge:hover { background: rgba(200,134,92,0.2); }
        .cc-action-btn.badge:disabled { opacity: 0.5; cursor: not-allowed; }
        .cc-action-btn.delete { background: rgba(200,70,70,0.08); border-color: rgba(200,70,70,0.2); color: #e08878; }
        .cc-action-btn.delete:hover { background: rgba(200,70,70,0.15); }

        /* Badge results */
        .cc-badge-result { margin-top: 1rem; padding: 1rem; background: rgba(200,134,92,0.06); border: 1px solid rgba(200,134,92,0.15); border-radius: 8px; }
        .cc-badge-result-title { font-size: 12px; font-weight: 500; color: #c8865c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
        .cc-badge-result-stats { font-size: 12px; color: #7a7060; margin-bottom: 8px; }
        .cc-winner-list { display: flex; flex-direction: column; gap: 4px; }
        .cc-winner-item { display: flex; align-items: center; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .cc-winner-rank { color: #c8865c; font-weight: 500; min-width: 30px; }
        .cc-winner-name { color: #f0ebe3; flex: 1; margin: 0 8px; }
        .cc-winner-likes { color: #524840; }

        .cc-msg-success { padding: 10px 14px; border-radius: 8px; font-size: 13px; background: rgba(80,160,90,0.15); border: 1px solid rgba(80,160,90,0.3); color: #7ec88a; margin-bottom: 1rem; }
        .cc-msg-error { padding: 10px 14px; border-radius: 8px; font-size: 13px; background: rgba(200,80,70,0.15); border: 1px solid rgba(200,80,70,0.3); color: #e08878; margin-bottom: 1rem; }
        .cc-empty { text-align: center; padding: 3rem; color: #524840; font-size: 14px; }

        /* Mood board modal */
        .mb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .mb-modal { background: #1a140e; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; gap: 1.6rem; }
        .mb-modal-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #f0ebe3; }
        .mb-section-label { font-size: 11px; font-weight: 500; color: #6a6050; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .mb-section { display: flex; flex-direction: column; }
        .mb-row { display: flex; gap: 8px; }
        .mb-input { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #f0ebe3; outline: none; }
        .mb-input:focus { border-color: rgba(200,134,92,0.5); }
        .mb-input::placeholder { color: #3a342c; }
        .mb-add-btn { padding: 9px 16px; background: rgba(200,134,92,0.15); border: 1px solid rgba(200,134,92,0.3); border-radius: 8px; color: #c8865c; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: 'DM Sans', sans-serif; transition: background 0.2s; }
        .mb-add-btn:hover { background: rgba(200,134,92,0.25); }
        .mb-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .mb-images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-top: 10px; }
        .mb-img-item { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
        .mb-img-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mb-img-remove { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.6); border: none; color: #fff; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .mb-palette { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .mb-color-swatch { width: 40px; height: 40px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; position: relative; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
        .mb-color-remove { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; text-align: center; padding: 2px 0; opacity: 0; transition: opacity 0.15s; }
        .mb-color-swatch:hover .mb-color-remove { opacity: 1; }
        .mb-links-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
        .mb-link-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .mb-link-title { font-size: 13px; color: #f0ebe3; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mb-link-url { font-size: 11px; color: #524840; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
        .mb-remove-btn { background: none; border: none; color: #524840; cursor: pointer; font-size: 13px; padding: 2px 4px; transition: color 0.15s; }
        .mb-remove-btn:hover { color: #e08878; }
        .mb-modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); }

        @media (max-width: 768px) {
          .cc-nav { padding: 1rem 1.2rem; }
          .cc-container { padding: 2rem 1.2rem; }
          .cc-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="cc-page">
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
          <a href="/" className="cc-back">← Ana sayfaya dön</a>
        </nav>

        <div className="cc-container">
          <div className="cc-header">
            <h1 className="cc-title">Admin <em>paneli.</em></h1>
            <button className="cc-btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'İptal' : '+ Yeni Konsept'}
            </button>
          </div>

          {message && (
            <div className={isSuccess ? 'cc-msg-success' : 'cc-msg-error'}>{message}</div>
          )}

          {showForm && (
            <div className="cc-form-card">
              <p className="cc-form-title">Yeni Konsept Oluştur</p>
              <form onSubmit={handleCreate}>
                <div className="cc-form-grid">
                  <div className="cc-field">
                    <label className="cc-label">Konsept Adı</label>
                    <input type="text" className="cc-input" placeholder="FALL 2026" required
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label">Rozet Adı</label>
                    <input type="text" className="cc-input" placeholder="FALL 2026 Champion"
                      value={form.badge_name} onChange={e => setForm({ ...form, badge_name: e.target.value })} />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label">Başlangıç Tarihi</label>
                    <input type="date" className="cc-input" required
                      value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label">Bitiş Tarihi</label>
                    <input type="date" className="cc-input" required
                      value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>

                <div className="cc-field">
                  <label className="cc-label">Açıklama</label>
                  <textarea className="cc-textarea" placeholder="Konseptin ruhu ve amacı..."
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="cc-field">
                  <label className="cc-label">Kurallar</label>
                  <textarea className="cc-textarea" placeholder="Hangi içerikler kabul edilir..."
                    value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} />
                </div>

                <div className="cc-field">
                  <label className="cc-label">Rozet Görseli</label>
                  <div className="cc-badge-upload">
                    <div className="cc-badge-preview">
                      {badgeImagePreview
                        ? <img src={badgeImagePreview} alt="Rozet" />
                        : '🏆'
                      }
                    </div>
                    <label className="cc-upload-label">
                      Görsel Seç
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBadgeImageChange} />
                    </label>
                    {badgeImagePreview && (
                      <span style={{ fontSize: 12, color: '#7ec88a' }}>✓ Yüklendi</span>
                    )}
                  </div>
                </div>

                <div className="cc-field">
                  <label className="cc-label">Durum</label>
                  <select className="cc-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="upcoming">Yakında</option>
                    <option value="active">Aktif</option>
                    <option value="ended">Tamamlandı</option>
                  </select>
                </div>

                <div className="cc-form-actions">
                  <button type="submit" className="cc-btn-primary" disabled={saving}>
                    {saving ? 'Kaydediliyor...' : 'Konsepti Oluştur'}
                  </button>
                  <button type="button" className="cc-btn-cancel" onClick={() => setShowForm(false)}>İptal</button>
                </div>
              </form>
            </div>
          )}

          {concepts.length === 0 ? (
            <div className="cc-empty">Henüz konsept yok.</div>
          ) : (
            concepts.map((concept) => (
              <div key={concept.id} className="cc-concept-card">
                <div className="cc-concept-header">
                  <div className="cc-concept-left">
                    <div className="cc-concept-badge-thumb">
                      {concept.badge_image_url
                        ? <img src={concept.badge_image_url} alt="Rozet" />
                        : '🏆'
                      }
                    </div>
                    <h2 className="cc-concept-name">{concept.name}</h2>
                  </div>
                  <span className="cc-status-badge" style={{ background: statusColor[concept.status], color: statusTextColor[concept.status] }}>
                    {statusLabel[concept.status]}
                  </span>
                </div>

                {concept.description && <p className="cc-concept-desc">{concept.description}</p>}
                {concept.rules && <p className="cc-concept-rules">Kurallar: {concept.rules}</p>}

                <div className="cc-concept-meta">
                  <span>Başlangıç: {new Date(concept.start_date).toLocaleDateString('tr-TR')}</span>
                  <span>Bitiş: {new Date(concept.end_date).toLocaleDateString('tr-TR')}</span>
                  {concept.badge_name && <span>Rozet: {concept.badge_name}</span>}
                </div>

                <div className="cc-concept-actions">
                  {concept.status !== 'active' && (
                    <button className="cc-action-btn active" onClick={() => handleStatusChange(concept.id, 'active')}>Aktif Yap</button>
                  )}
                  {concept.status !== 'upcoming' && (
                    <button className="cc-action-btn" onClick={() => handleStatusChange(concept.id, 'upcoming')}>Yakında'ya Al</button>
                  )}
                  {concept.status !== 'ended' && (
                    <button className="cc-action-btn" onClick={() => handleStatusChange(concept.id, 'ended')}>Tamamla</button>
                  )}
                  <button
                    className="cc-action-btn badge"
                    onClick={() => handleDistributeBadges(concept)}
                    disabled={distributingId === concept.id}
                  >
                    {distributingId === concept.id ? 'Dağıtılıyor...' : '🏆 Rozet Dağıt'}
                  </button>
                  <button className="cc-action-btn" onClick={() => openMoodBoard(concept)}>🎨 Mood Board</button>
                  <button className="cc-action-btn delete" onClick={() => handleDelete(concept.id)}>Sil</button>
                </div>

                {badgeResults[concept.id] && (
                  <div className="cc-badge-result">
                    <p className="cc-badge-result-title">Rozet Dağıtım Sonucu</p>
                    <p className="cc-badge-result-stats">
                      {badgeResults[concept.id].total} katılımcı · %5 eşiği: {badgeResults[concept.id].threshold} kişi · {badgeResults[concept.id].awarded} rozet verildi · Eşik beğeni: {badgeResults[concept.id].cutoffLikes}
                    </p>
                    <div className="cc-winner-list">
                      {badgeResults[concept.id].winners.map((w: any, i: number) => (
                        <div key={w.userId} className="cc-winner-item">
                          <span className="cc-winner-rank">#{i + 1}</span>
                          <span className="cc-winner-name">{w.username}</span>
                          <span className="cc-winner-likes">{w.totalLikes} beğeni</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mood Board Modal */}
      {mbConceptId && (
        <div className="mb-overlay" onClick={() => setMbConceptId(null)}>
          <div className="mb-modal" onClick={e => e.stopPropagation()}>
            <p className="mb-modal-title">🎨 Mood Board Düzenle</p>

            {/* Görseller */}
            <div className="mb-section">
              <p className="mb-section-label">İlham Görselleri ({mbData.images.length}/8)</p>
              <div className="mb-row">
                <input className="mb-input" placeholder="Görsel URL yapıştır..." value={mbImageInput} onChange={e => setMbImageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (mbImageInput.trim() && mbData.images.length < 8) { setMbData(d => ({ ...d, images: [...d.images, mbImageInput.trim()] })); setMbImageInput('') }}}} />
                <button className="mb-add-btn" onClick={() => { if (mbImageInput.trim() && mbData.images.length < 8) { setMbData(d => ({ ...d, images: [...d.images, mbImageInput.trim()] })); setMbImageInput('') }}}>Ekle</button>
                <label className="mb-add-btn" style={{ cursor: 'pointer' }}>
                  {mbImageUploading ? 'Yükleniyor...' : 'Yükle'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMbImageUpload} disabled={mbImageUploading} />
                </label>
              </div>
              {mbData.images.length > 0 && (
                <div className="mb-images-grid">
                  {mbData.images.map((url, i) => (
                    <div key={i} className="mb-img-item">
                      <img src={url} alt="" />
                      <button className="mb-img-remove" onClick={() => setMbData(d => ({ ...d, images: d.images.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Renk Paleti */}
            <div className="mb-section">
              <p className="mb-section-label">Renk Paleti ({mbData.palette.length}/10)</p>
              <div className="mb-row" style={{ alignItems: 'center' }}>
                <input type="color" value={mbColorInput} onChange={e => setMbColorInput(e.target.value)}
                  style={{ width: 44, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', padding: 2 }} />
                <input className="mb-input" placeholder="#hex renk kodu" value={mbColorInput} onChange={e => setMbColorInput(e.target.value)} style={{ maxWidth: 140 }} />
                <button className="mb-add-btn" onClick={() => { if (mbData.palette.length < 10) { setMbData(d => ({ ...d, palette: [...d.palette, mbColorInput] })) }}}>Ekle</button>
              </div>
              {mbData.palette.length > 0 && (
                <div className="mb-palette">
                  {mbData.palette.map((color, i) => (
                    <div key={i} className="mb-color-swatch" style={{ background: color }} onClick={() => setMbData(d => ({ ...d, palette: d.palette.filter((_, j) => j !== i) }))} title={`${color} — kaldırmak için tıkla`}>
                      <span className="mb-color-remove">✕</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* İlham Linkleri */}
            <div className="mb-section">
              <p className="mb-section-label">İlham Linkleri ({mbData.links.length}/8)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="mb-input" placeholder="Başlık (örn: Behance koleksiyonu)" value={mbLinkTitle} onChange={e => setMbLinkTitle(e.target.value)} />
                <div className="mb-row">
                  <input className="mb-input" placeholder="https://..." value={mbLinkUrl} onChange={e => setMbLinkUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (mbLinkTitle.trim() && mbLinkUrl.trim() && mbData.links.length < 8) { setMbData(d => ({ ...d, links: [...d.links, { title: mbLinkTitle.trim(), url: mbLinkUrl.trim() }] })); setMbLinkTitle(''); setMbLinkUrl('') }}}} />
                  <button className="mb-add-btn" onClick={() => { if (mbLinkTitle.trim() && mbLinkUrl.trim() && mbData.links.length < 8) { setMbData(d => ({ ...d, links: [...d.links, { title: mbLinkTitle.trim(), url: mbLinkUrl.trim() }] })); setMbLinkTitle(''); setMbLinkUrl('') }}}>Ekle</button>
                </div>
              </div>
              {mbData.links.length > 0 && (
                <div className="mb-links-list">
                  {mbData.links.map((link, i) => (
                    <div key={i} className="mb-link-item">
                      <span style={{ fontSize: 14 }}>🔗</span>
                      <span className="mb-link-title">{link.title}</span>
                      <span className="mb-link-url">{link.url}</span>
                      <button className="mb-remove-btn" onClick={() => setMbData(d => ({ ...d, links: d.links.filter((_, j) => j !== i) }))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-modal-footer">
              <button className="cc-btn-cancel" onClick={() => setMbConceptId(null)}>İptal</button>
              <button className="cc-btn-primary" onClick={handleSaveMoodBoard} disabled={mbSaving}>{mbSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
