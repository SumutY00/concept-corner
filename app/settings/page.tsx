'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { showToast } from '../components/ToastContainer'

type Section = 'account' | 'password' | 'notifications' | 'appearance' | 'privacy' | 'danger'

type UserProfile = {
  id: string
  email: string
  username: string
  bio: string
  is_private: boolean
  notification_likes: boolean
  notification_comments: boolean
  notification_follows: boolean
  notification_mentions: boolean
  notification_messages: boolean
  preferred_theme: string
}

type Theme = {
  id: string
  label: string
  colors: { bg: string; surface: string; primary: string; text: string }
}

const THEMES: Theme[] = [
  {
    id: 'dark-social',
    label: 'Dark Social',
    colors: { bg: '#0B1020', surface: '#12182B', primary: '#667eea', text: '#F3F6FF' },
  },
  {
    id: 'soft-modern',
    label: 'Soft Modern',
    colors: { bg: '#fafbfc', surface: '#FFFFFF', primary: '#667eea', text: '#1a1a2e' },
  },
  {
    id: 'minimal-energetic',
    label: 'Minimal',
    colors: { bg: '#FCFCFE', surface: '#FFFFFF', primary: '#667eea', text: '#1a1a2e' },
  },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('account')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Account form
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        const p: UserProfile = {
          id: user.id,
          email: user.email ?? '',
          username: data.username ?? '',
          bio: data.bio ?? '',
          is_private: data.is_private ?? false,
          notification_likes: data.notification_likes ?? true,
          notification_comments: data.notification_comments ?? true,
          notification_follows: data.notification_follows ?? true,
          notification_mentions: data.notification_mentions ?? true,
          notification_messages: data.notification_messages ?? true,
          preferred_theme: data.preferred_theme ?? 'dark-social',
        }
        setProfile(p)
        setUsername(p.username)
        setBio(p.bio)
      }
      setLoading(false)
    }
    load()
  }, [])

  // --- Hesap kaydet ---
  const handleAccountSave = async () => {
    if (!profile) return
    setAccountSaving(true)

    // Kullanıcı adı benzersizlik kontrolü
    if (username !== profile.username) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', profile.id)
        .maybeSingle()

      if (existing) {
        showToast('Bu kullanıcı adı zaten alınmış.', 'error')
        setAccountSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('users')
      .update({ username, bio })
      .eq('id', profile.id)

    if (error) {
      showToast('Kaydedilemedi: ' + error.message, 'error')
    } else {
      setProfile(p => p ? { ...p, username, bio } : p)
      showToast('Profil güncellendi!', 'success')
    }
    setAccountSaving(false)
  }

  // --- Şifre değiştir ---
  const handlePasswordChange = async () => {
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Şifre en az 6 karakter olmalı.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Şifreler eşleşmiyor.'); return }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError('Şifre güncellenemedi: ' + error.message)
    } else {
      setNewPassword('')
      setConfirmPassword('')
      showToast('Şifre güncellendi!', 'success')
    }
    setPasswordSaving(false)
  }

  // --- Toggle güncelle ---
  const handleToggle = async (field: keyof UserProfile, value: boolean) => {
    if (!profile) return
    setProfile(p => p ? { ...p, [field]: value } : p)
    await supabase.from('users').update({ [field]: value }).eq('id', profile.id)
  }

  // --- Tema değiştir ---
  const handleTheme = async (themeId: string) => {
    if (!profile) return
    setProfile(p => p ? { ...p, preferred_theme: themeId } : p)
    localStorage.setItem('cc-theme', themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    await supabase.from('users').update({ preferred_theme: themeId }).eq('id', profile.id)
    showToast('Tema güncellendi!', 'success')
  }

  // --- Hesap sil ---
  const handleDeleteAccount = async () => {
    if (!profile || deleteConfirmInput !== profile.username) return
    setDeleting(true)

    try {
      // Önce postların görsellerini storage'dan sil
      const { data: posts } = await supabase
        .from('posts')
        .select('image_url, images')
        .eq('user_id', profile.id)

      if (posts) {
        const filePaths: string[] = []
        for (const post of posts) {
          const imgs: string[] = post.images ?? (post.image_url ? [post.image_url] : [])
          for (const url of imgs) {
            const match = url.match(/\/storage\/v1\/object\/public\/posts\/(.+)/)
            if (match) filePaths.push(match[1])
          }
        }
        if (filePaths.length > 0) {
          await supabase.storage.from('posts').remove(filePaths)
        }
      }

      // Avatar'ı sil
      const avatarPath = `avatars/${profile.id}`
      await supabase.storage.from('posts').remove([avatarPath + '.jpg', avatarPath + '.png', avatarPath + '.webp'])

      // RPC ile veritabanı verilerini sil
      const { error: rpcError } = await supabase.rpc('delete_user_account')
      if (rpcError) {
        showToast('Hesap silinemedi: ' + rpcError.message, 'error')
        setDeleting(false)
        return
      }

      await supabase.auth.signOut()
      router.push('/auth/signup')
    } catch {
      showToast('Bir hata oluştu.', 'error')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cc-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--cc-border)', borderTopColor: '#667eea', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!profile) return null

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'account', label: 'Hesap Bilgileri', icon: '👤' },
    { id: 'password', label: 'Şifre', icon: '🔑' },
    { id: 'notifications', label: 'Bildirimler', icon: '🔔' },
    { id: 'appearance', label: 'Görünüm', icon: '🎨' },
    { id: 'privacy', label: 'Gizlilik', icon: '🔒' },
    { id: 'danger', label: 'Hesap Silme', icon: '⚠️' },
  ]

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .s-page { min-height: 100vh; background: var(--cc-bg); font-family: var(--cc-font-body); color: var(--cc-text-primary); }

        /* Navbar */
        .s-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem; background: var(--cc-navbar); backdrop-filter: blur(12px); border-bottom: 1px solid var(--cc-border); }
        .s-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .s-logo-text { font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; color: var(--cc-text-primary); }
        .s-back { font-size: 13px; color: var(--cc-text-muted); text-decoration: none; transition: color 0.2s; }
        .s-back:hover { color: var(--cc-text-primary); }

        /* Layout */
        .s-layout { max-width: 960px; margin: 0 auto; padding: 2.5rem 2rem 5rem; display: grid; grid-template-columns: 220px 1fr; gap: 2rem; align-items: start; }

        /* Sol menü */
        .s-sidebar { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); overflow: hidden; position: sticky; top: 80px; }
        .s-sidebar-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--cc-text-muted); padding: 14px 16px 8px; }
        .s-nav-item { display: flex; align-items: center; gap: 10px; padding: 11px 16px; font-size: 14px; font-weight: 500; color: var(--cc-text-secondary); cursor: pointer; transition: background 0.15s, color 0.15s; border: none; background: none; width: 100%; text-align: left; }
        .s-nav-item:hover { background: var(--cc-surface-alt); color: var(--cc-text-primary); }
        .s-nav-item.active { background: rgba(102,126,234,0.1); color: #667eea; }
        .s-nav-item-icon { font-size: 15px; width: 20px; text-align: center; }
        .s-nav-item.danger-nav { color: var(--cc-like); }
        .s-nav-item.danger-nav:hover { background: rgba(255,90,122,0.08); }
        .s-nav-item.danger-nav.active { background: rgba(255,90,122,0.1); color: var(--cc-like); }

        /* Sağ içerik */
        .s-content { display: flex; flex-direction: column; gap: 1.5rem; }

        /* Kart */
        .s-card { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); padding: 1.8rem; }
        .s-card-title { font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; color: var(--cc-text-primary); margin-bottom: 4px; }
        .s-card-sub { font-size: 13px; color: var(--cc-text-muted); margin-bottom: 1.5rem; }

        /* Form */
        .s-field { margin-bottom: 1.2rem; }
        .s-label { display: block; font-size: 12px; font-weight: 600; color: var(--cc-text-muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .s-input, .s-textarea {
          width: 100%; background: var(--cc-surface-alt); border: 1.5px solid var(--cc-border);
          border-radius: 10px; padding: 12px 14px;
          font-family: var(--cc-font-body); font-size: 14px; color: var(--cc-text-primary); outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .s-input:focus, .s-textarea:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.12); }
        .s-input::placeholder, .s-textarea::placeholder { color: var(--cc-text-muted); opacity: 0.6; }
        .s-input:read-only { opacity: 0.6; cursor: not-allowed; }
        .s-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
        .s-hint { font-size: 11px; color: var(--cc-text-muted); margin-top: 4px; }

        /* Butonlar */
        .s-btn-save { padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 10px; font-family: var(--cc-font-body); font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; transition: opacity 0.2s; }
        .s-btn-save:hover:not(:disabled) { opacity: 0.88; }
        .s-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .s-btn-cancel { padding: 10px 20px; background: var(--cc-surface-alt); border: 1.5px solid var(--cc-border); border-radius: 10px; font-family: var(--cc-font-body); font-size: 14px; font-weight: 500; color: var(--cc-text-secondary); cursor: pointer; transition: all 0.2s; }
        .s-btn-cancel:hover { border-color: var(--cc-text-muted); color: var(--cc-text-primary); }

        /* Toggle */
        .s-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--cc-border); }
        .s-toggle-row:last-child { border-bottom: none; padding-bottom: 0; }
        .s-toggle-row:first-child { padding-top: 0; }
        .s-toggle-info {}
        .s-toggle-title { font-size: 14px; font-weight: 500; color: var(--cc-text-primary); margin-bottom: 2px; }
        .s-toggle-desc { font-size: 12px; color: var(--cc-text-muted); }
        .s-switch { position: relative; width: 46px; height: 26px; flex-shrink: 0; cursor: pointer; }
        .s-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .s-switch-track {
          position: absolute; inset: 0; border-radius: 13px;
          transition: background 0.25s;
        }
        .s-switch-thumb {
          position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; transition: left 0.25s; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }

        /* Tema kartları */
        .s-theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .s-theme-card { border: 2px solid var(--cc-border); border-radius: 12px; padding: 14px; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; background: var(--cc-surface-alt); }
        .s-theme-card:hover { border-color: var(--cc-text-muted); }
        .s-theme-card.selected { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
        .s-theme-preview { display: flex; gap: 4px; margin-bottom: 10px; border-radius: 8px; overflow: hidden; height: 40px; }
        .s-theme-swatch { flex: 1; }
        .s-theme-name { font-size: 12px; font-weight: 600; color: var(--cc-text-primary); margin-bottom: 2px; }
        .s-theme-check { font-size: 11px; color: #667eea; font-weight: 600; }

        /* Hata / başarı mesajları */
        .s-msg-error { padding: 10px 14px; border-radius: 10px; font-size: 13px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; margin-bottom: 1rem; }
        .s-msg-success { padding: 10px 14px; border-radius: 10px; font-size: 13px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; margin-bottom: 1rem; }

        /* Tehlikeli bölge */
        .s-danger-card { background: rgba(255,90,122,0.04); border: 1.5px solid rgba(255,90,122,0.25); border-radius: var(--cc-radius); padding: 1.8rem; }
        .s-danger-title { font-family: var(--cc-font-heading); font-size: 17px; font-weight: 700; color: var(--cc-like); margin-bottom: 6px; }
        .s-danger-desc { font-size: 13px; color: var(--cc-text-secondary); margin-bottom: 1.2rem; line-height: 1.6; }
        .s-btn-danger { padding: 10px 22px; background: none; border: 1.5px solid var(--cc-like); border-radius: 10px; font-family: var(--cc-font-body); font-size: 14px; font-weight: 600; color: var(--cc-like); cursor: pointer; transition: background 0.2s; }
        .s-btn-danger:hover { background: rgba(255,90,122,0.08); }

        /* Modal */
        .s-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
        .s-modal { background: var(--cc-surface); border: 1px solid var(--cc-border); border-radius: var(--cc-radius); width: 100%; max-width: 440px; padding: 2rem; box-shadow: 0 24px 64px rgba(0,0,0,0.4); }
        .s-modal-title { font-family: var(--cc-font-heading); font-size: 20px; font-weight: 700; color: var(--cc-like); margin-bottom: 8px; }
        .s-modal-body { font-size: 14px; color: var(--cc-text-secondary); line-height: 1.6; margin-bottom: 1.5rem; }
        .s-modal-body strong { color: var(--cc-text-primary); }
        .s-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem; }
        .s-btn-danger-confirm { padding: 10px 20px; background: var(--cc-like); border: none; border-radius: 10px; font-family: var(--cc-font-body); font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; transition: opacity 0.2s; }
        .s-btn-danger-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .s-btn-danger-confirm:hover:not(:disabled) { opacity: 0.88; }

        /* Responsive */
        @media (max-width: 768px) {
          .s-nav { padding: 1rem 1.2rem; }
          .s-layout { grid-template-columns: 1fr; padding: 1.5rem 1rem 5rem; gap: 1rem; }
          .s-sidebar { position: static; display: flex; overflow-x: auto; gap: 0; border-radius: var(--cc-radius-sm); }
          .s-sidebar-title { display: none; }
          .s-nav-item { white-space: nowrap; flex-shrink: 0; border-radius: 0; }
          .s-theme-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
        }
      `}</style>

      <div className="s-page">
        {/* Navbar */}
        <nav className="s-nav">
          <a href="/" className="s-logo">
            <img src="/logo.png" alt="Concept Corner" style={{ height: 44, width: 'auto' }} />
            <span className="s-logo-text">Concept Corner</span>
          </a>
          <a href={`/profile/${profile.username}`} className="s-back">← Profile dön</a>
        </nav>

        <div className="s-layout">
          {/* Sol menü */}
          <div className="s-sidebar">
            <p className="s-sidebar-title">Ayarlar</p>
            {navItems.map(item => (
              <button
                key={item.id}
                className={`s-nav-item ${activeSection === item.id ? 'active' : ''} ${item.id === 'danger' ? 'danger-nav' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="s-nav-item-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Sağ içerik */}
          <div className="s-content">

            {/* A) HESAP BİLGİLERİ */}
            {activeSection === 'account' && (
              <div className="s-card">
                <p className="s-card-title">Hesap Bilgileri</p>
                <p className="s-card-sub">Profil bilgilerini buradan güncelleyebilirsin.</p>

                <div className="s-field">
                  <label className="s-label">E-posta</label>
                  <input className="s-input" value={profile.email} readOnly />
                  <p className="s-hint">E-posta adresi değiştirilemez.</p>
                </div>

                <div className="s-field">
                  <label className="s-label">Kullanıcı Adı</label>
                  <input
                    className="s-input"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="kullaniciadi"
                    maxLength={30}
                  />
                  <p className="s-hint">Küçük harf, rakam ve alt çizgi kullanabilirsin. /profile/{username}</p>
                </div>

                <div className="s-field">
                  <label className="s-label">Bio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({bio.length}/200)</span></label>
                  <textarea
                    className="s-textarea"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Kendini kısaca anlat..."
                    maxLength={200}
                  />
                </div>

                <button className="s-btn-save" onClick={handleAccountSave} disabled={accountSaving}>
                  {accountSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            )}

            {/* B) ŞİFRE */}
            {activeSection === 'password' && (
              <div className="s-card">
                <p className="s-card-title">Şifre Değiştir</p>
                <p className="s-card-sub">Hesabının güvenliği için güçlü bir şifre seç.</p>

                {passwordError && <div className="s-msg-error">{passwordError}</div>}

                <div className="s-field">
                  <label className="s-label">Yeni Şifre</label>
                  <input
                    type="password"
                    className="s-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <p className="s-hint">En az 6 karakter</p>
                </div>

                <div className="s-field">
                  <label className="s-label">Şifre Tekrar</label>
                  <input
                    type="password"
                    className="s-input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="s-hint" style={{ color: '#991b1b' }}>Şifreler eşleşmiyor</p>
                  )}
                </div>

                <button
                  className="s-btn-save"
                  onClick={handlePasswordChange}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                >
                  {passwordSaving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            )}

            {/* C) BİLDİRİMLER */}
            {activeSection === 'notifications' && (
              <div className="s-card">
                <p className="s-card-title">Bildirim Tercihleri</p>
                <p className="s-card-sub">Hangi bildirimler almak istediğini seç.</p>

                {([
                  { field: 'notification_likes' as keyof UserProfile, title: 'Beğeniler', desc: 'Biri gönderini beğendiğinde bildirim al' },
                  { field: 'notification_comments' as keyof UserProfile, title: 'Yorumlar', desc: 'Biri gönderine yorum yaptığında bildirim al' },
                  { field: 'notification_follows' as keyof UserProfile, title: 'Takipler', desc: 'Biri seni takip ettiğinde bildirim al' },
                  { field: 'notification_mentions' as keyof UserProfile, title: 'Etiketlenmeler', desc: 'Biri seni bir yorumda etiketlediğinde bildirim al' },
                  { field: 'notification_messages' as keyof UserProfile, title: 'Mesajlar', desc: 'Yeni mesaj aldığında bildirim al' },
                ] as { field: keyof UserProfile; title: string; desc: string }[]).map(({ field, title, desc }) => {
                  const isOn = !!profile[field]
                  return (
                    <div key={field} className="s-toggle-row">
                      <div className="s-toggle-info">
                        <p className="s-toggle-title">{title}</p>
                        <p className="s-toggle-desc">{desc}</p>
                      </div>
                      <label className="s-switch" style={{ marginLeft: 16 }}>
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={e => handleToggle(field, e.target.checked)}
                        />
                        <div className="s-switch-track" style={{ background: isOn ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'var(--cc-border)' }} />
                        <div className="s-switch-thumb" style={{ left: isOn ? 23 : 3 }} />
                      </label>
                    </div>
                  )
                })}
              </div>
            )}

            {/* D) GÖRÜNÜM */}
            {activeSection === 'appearance' && (
              <div className="s-card">
                <p className="s-card-title">Görünüm</p>
                <p className="s-card-sub">Uygulama temasını değiştir.</p>

                <div className="s-theme-grid">
                  {THEMES.map(theme => {
                    const isSelected = profile.preferred_theme === theme.id
                    return (
                      <div
                        key={theme.id}
                        className={`s-theme-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTheme(theme.id)}
                      >
                        <div className="s-theme-preview">
                          <div className="s-theme-swatch" style={{ background: theme.colors.bg }} />
                          <div className="s-theme-swatch" style={{ background: theme.colors.surface }} />
                          <div className="s-theme-swatch" style={{ background: theme.colors.primary }} />
                          <div className="s-theme-swatch" style={{ background: theme.colors.text, opacity: 0.6 }} />
                        </div>
                        <p className="s-theme-name">{theme.label}</p>
                        {isSelected && <p className="s-theme-check">✓ Aktif</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* E) GİZLİLİK */}
            {activeSection === 'privacy' && (
              <div className="s-card">
                <p className="s-card-title">Gizlilik</p>
                <p className="s-card-sub">Hesabının kimler tarafından görülebileceğini kontrol et.</p>

                <div className="s-toggle-row">
                  <div className="s-toggle-info">
                    <p className="s-toggle-title">🔒 Gizli Hesap</p>
                    <p className="s-toggle-desc">
                      {profile.is_private
                        ? 'Sadece onayladığın kişiler seni takip edebilir ve gönderilerini görebilir.'
                        : 'Herkes profilini ve gönderilerini görebilir.'}
                    </p>
                  </div>
                  <label className="s-switch" style={{ marginLeft: 16 }}>
                    <input
                      type="checkbox"
                      checked={profile.is_private}
                      onChange={e => handleToggle('is_private', e.target.checked)}
                    />
                    <div className="s-switch-track" style={{ background: profile.is_private ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'var(--cc-border)' }} />
                    <div className="s-switch-thumb" style={{ left: profile.is_private ? 23 : 3 }} />
                  </label>
                </div>
              </div>
            )}

            {/* F) HESAP SİLME */}
            {activeSection === 'danger' && (
              <div className="s-danger-card">
                <p className="s-danger-title">⚠️ Tehlikeli Bölge</p>
                <p className="s-danger-desc">
                  Hesabını silmek tüm verilerini (gönderiler, yorumlar, beğeniler, takipler, mesajlar) kalıcı olarak siler.
                  <br /><br />
                  <strong>Bu işlem geri alınamaz.</strong>
                </p>
                <button className="s-btn-danger" onClick={() => setShowDeleteModal(true)}>
                  Hesabımı Sil
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Silme onay modalı */}
      {showDeleteModal && (
        <div className="s-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="s-modal" onClick={e => e.stopPropagation()}>
            <p className="s-modal-title">Hesabı Sil</p>
            <div className="s-modal-body">
              Bu işlem <strong>geri alınamaz</strong>. Tüm gönderiler, yorumlar, mesajlar ve diğer veriler kalıcı olarak silinecektir.
              <br /><br />
              Devam etmek için kullanıcı adını yaz: <strong>{profile.username}</strong>
              <div style={{ marginTop: 12 }}>
                <input
                  className="s-input"
                  value={deleteConfirmInput}
                  onChange={e => setDeleteConfirmInput(e.target.value)}
                  placeholder={profile.username}
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="s-modal-actions">
              <button className="s-btn-cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmInput('') }}>
                İptal
              </button>
              <button
                className="s-btn-danger-confirm"
                disabled={deleteConfirmInput !== profile.username || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'Siliniyor...' : 'Hesabımı Kalıcı Olarak Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
