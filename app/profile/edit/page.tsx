'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EditProfilePage() {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username ?? '')
        setBio(profile.bio ?? '')
        setCurrentAvatar(profile.avatar_url ?? null)
        setIsPrivate(profile.is_private ?? false)
      }

      setLoading(false)
    }

    load()
  }, [])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let avatarUrl = currentAvatar

    if (avatar) {
      const fileExt = avatar.name.split('.').pop()
      const filePath = `avatars/${user.id}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, avatar, { upsert: true })

      if (uploadError) {
        setMessage('Avatar yüklenemedi: ' + uploadError.message)
        setIsSuccess(false)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(filePath)
      avatarUrl = urlData.publicUrl
    }

    const { error } = await supabase
      .from('users')
      .update({
        username,
        bio,
        avatar_url: avatarUrl,
        is_private: isPrivate,
      })
      .eq('id', user.id)

    if (error) {
      setMessage('Kaydedilemedi: ' + error.message)
      setIsSuccess(false)
    } else {
      setIsSuccess(true)
      setMessage('Profil güncellendi!')
      setTimeout(() => router.push(`/profile/${username}`), 1200)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0e0c0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid rgba(200,134,92,0.3)',
          borderTopColor: '#c8865c',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const displayAvatar = avatarPreview || currentAvatar

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .cc-page {
          min-height: 100vh; background: #0e0c0a;
          font-family: 'DM Sans', sans-serif; color: #f0ebe3;
          position: relative;
        }

        .cc-glow {
          position: fixed; top: -160px; left: -160px;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(210,130,70,0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }

        .cc-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2.5rem;
          background: rgba(14,12,10,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .cc-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }

        .cc-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 18px; color: #f0ebe3; letter-spacing: 0.02em;
        }

        .cc-back {
          font-size: 13px; color: #6a6050; text-decoration: none;
          transition: color 0.2s;
        }
        .cc-back:hover { color: #f0ebe3; }

        .cc-container {
          position: relative; z-index: 1;
          max-width: 560px; margin: 0 auto;
          padding: 4rem 2rem;
        }

        .cc-title {
          font-family: 'Playfair Display', serif;
          font-size: 36px; font-weight: 700;
          color: #f0ebe3; line-height: 1.1;
          margin-bottom: 6px;
        }

        .cc-title em { font-style: italic; color: #c8865c; }

        .cc-divider {
          width: 48px; height: 1px;
          background: linear-gradient(90deg, #c8865c, transparent);
          margin: 1rem 0 2.5rem;
        }

        /* Avatar */
        .cc-avatar-section {
          display: flex; align-items: center; gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .cc-avatar-wrap {
          position: relative; width: 80px; height: 80px;
          border-radius: 50%; flex-shrink: 0;
          cursor: pointer;
        }

        .cc-avatar-img {
          width: 80px; height: 80px; border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(200,134,92,0.2);
        }

        .cc-avatar-placeholder {
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(200,134,92,0.15);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 28px; font-weight: 700; color: #c8865c;
          border: 1px solid rgba(200,134,92,0.2);
        }

        .cc-avatar-overlay {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }

        .cc-avatar-wrap:hover .cc-avatar-overlay { opacity: 1; }

        .cc-avatar-input {
          position: absolute; inset: 0; opacity: 0;
          cursor: pointer; border-radius: 50%;
        }

        .cc-avatar-hint {
          font-size: 13px; color: #6a6050; font-weight: 300;
        }

        .cc-avatar-hint strong {
          display: block; font-size: 14px;
          color: #f0ebe3; font-weight: 500;
          margin-bottom: 3px;
        }

        /* Form */
        .cc-label {
          display: block; font-size: 11px; font-weight: 500;
          color: #6a6050; text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 7px;
        }

        .cc-input, .cc-textarea {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; color: #f0ebe3; outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .cc-input::placeholder, .cc-textarea::placeholder { color: #3a342c; }

        .cc-input:focus, .cc-textarea:focus {
          border-color: rgba(200,134,92,0.5);
          background: rgba(200,134,92,0.04);
        }

        .cc-textarea { resize: vertical; min-height: 90px; line-height: 1.6; }

        .cc-field { margin-bottom: 1.4rem; }

        .cc-hint-text {
          font-size: 11px; color: #3a342c;
          margin-top: 5px; padding-left: 2px;
        }

        .cc-btn {
          width: 100%; padding: 14px;
          background: #c8865c; border: none; border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500; color: #1a120a;
          cursor: pointer; letter-spacing: 0.02em;
          transition: background 0.2s, opacity 0.2s;
          margin-top: 0.5rem;
        }

        .cc-btn:hover:not(:disabled) { background: #d99a72; }
        .cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-msg-success {
          padding: 10px 14px; border-radius: 8px; font-size: 13px;
          background: rgba(80,160,90,0.15);
          border: 1px solid rgba(80,160,90,0.3);
          color: #7ec88a; margin-bottom: 1rem;
        }

        .cc-msg-error {
          padding: 10px 14px; border-radius: 8px; font-size: 13px;
          background: rgba(200,80,70,0.15);
          border: 1px solid rgba(200,80,70,0.3);
          color: #e08878; margin-bottom: 1rem;
        }

        .cc-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; margin-bottom: 1.4rem;
          cursor: pointer; transition: border-color 0.2s;
        }
        .cc-toggle-row:hover { border-color: rgba(200,134,92,0.3); }
        .cc-toggle-info { flex: 1; }
        .cc-toggle-title { font-size: 14px; font-weight: 500; color: #f0ebe3; margin-bottom: 3px; }
        .cc-toggle-desc { font-size: 12px; color: #524840; line-height: 1.5; }
        .cc-switch {
          width: 44px; height: 24px; border-radius: 12px; flex-shrink: 0;
          position: relative; transition: background 0.25s; cursor: pointer;
          border: none; outline: none; padding: 0;
        }
        .cc-switch-thumb {
          position: absolute; top: 3px; width: 18px; height: 18px;
          border-radius: 50%; background: #fff;
          transition: left 0.25s; pointer-events: none;
        }
      `}</style>

      <div className="cc-page">
        <div className="cc-glow" />

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
          <a href={`/profile/${username}`} className="cc-back">← Profile dön</a>
        </nav>

        <div className="cc-container">
          <h1 className="cc-title">Profili <em>düzenle.</em></h1>
          <div className="cc-divider" />

          <form onSubmit={handleSave}>
            {/* Avatar */}
            <div className="cc-avatar-section">
              <div className="cc-avatar-wrap">
                {displayAvatar
                  ? <img src={displayAvatar} alt="" className="cc-avatar-img" />
                  : (
                    <div className="cc-avatar-placeholder">
                      {username?.[0]?.toUpperCase()}
                    </div>
                  )
                }
                <div className="cc-avatar-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="cc-avatar-input"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="cc-avatar-hint">
                <strong>Profil Fotoğrafı</strong>
                Değiştirmek için tıkla
              </div>
            </div>

            <div className="cc-field">
              <label className="cc-label">Kullanıcı Adı</label>
              <input
                type="text"
                className="cc-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="kullaniciadi"
              />
              <p className="cc-hint-text">Profil linkin: /profile/{username}</p>
            </div>

            <div className="cc-field">
              <label className="cc-label">Bio</label>
              <textarea
                className="cc-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Kendini birkaç kelimeyle anlat..."
                maxLength={160}
              />
              <p className="cc-hint-text">{bio.length}/160 karakter</p>
            </div>

            <div className="cc-toggle-row" onClick={() => setIsPrivate(p => !p)}>
              <div className="cc-toggle-info">
                <p className="cc-toggle-title">🔒 Gizli Hesap</p>
                <p className="cc-toggle-desc">
                  {isPrivate
                    ? 'Sadece onayladığın kişiler seni takip edebilir ve gönderilerini görebilir.'
                    : 'Herkes profilini ve gönderilerini görebilir.'}
                </p>
              </div>
              <button
                type="button"
                className="cc-switch"
                style={{ background: isPrivate ? '#c8865c' : 'rgba(255,255,255,0.12)' }}
                onClick={e => { e.stopPropagation(); setIsPrivate(p => !p) }}
              >
                <span className="cc-switch-thumb" style={{ left: isPrivate ? 23 : 3 }} />
              </button>
            </div>

            {message && (
              <div className={isSuccess ? 'cc-msg-success' : 'cc-msg-error'}>
                {message}
              </div>
            )}

            <button type="submit" className="cc-btn" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
