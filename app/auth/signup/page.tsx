'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setMessage('Kayıt başarısız: ' + authError.message)
      setIsSuccess(false)
      setLoading(false)
      return
    }

    if (authData.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            username: username,
            avatar_url: null,
            bio: null,
          },
        ])

      if (dbError) {
        setMessage('Profil oluşturulamadı: ' + dbError.message)
        setIsSuccess(false)
        setLoading(false)
        return
      }
    }

    setIsSuccess(true)
    setMessage('Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...')
    setTimeout(() => {
      router.push('/auth/login')
    }, 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .cc-page {
          min-height: 100vh;
          background: #0e0c0a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .cc-page::before {
          content: '';
          position: absolute;
          top: -120px; left: -120px;
          width: 480px; height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(210,130,70,0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .cc-page::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 320px; height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(140,100,200,0.10) 0%, transparent 70%);
          pointer-events: none;
        }

        .cc-card {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        .cc-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 2rem;
          text-decoration: none;
        }

        .cc-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          color: #f0ebe3;
          letter-spacing: 0.02em;
        }

        .cc-title {
          font-family: 'Playfair Display', serif;
          font-size: 42px;
          font-weight: 700;
          color: #f0ebe3;
          line-height: 1.1;
          margin: 0 0 6px;
        }

        .cc-title em {
          font-style: italic;
          color: #c8865c;
        }

        .cc-subtitle {
          font-size: 14px;
          color: #7a7060;
          font-weight: 300;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .cc-divider {
          width: 48px;
          height: 1px;
          background: linear-gradient(90deg, #c8865c, transparent);
          margin: 1.2rem 0;
        }

        .cc-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #6a6050;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 7px;
        }

        .cc-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 8px;
          padding: 13px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #f0ebe3 !important;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .cc-input::placeholder {
          color: #3a342c;
        }

        .cc-input:focus {
          border-color: rgba(200,134,92,0.5) !important;
          background: rgba(200,134,92,0.04) !important;
        }

        .cc-hint {
          font-size: 11px;
          color: #524840;
          margin-top: 5px;
          padding-left: 2px;
        }

        .cc-btn {
          width: 100%;
          margin-top: 0.4rem;
          padding: 14px;
          background: #c8865c;
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #1a120a;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: background 0.2s, transform 0.1s, opacity 0.2s;
        }

        .cc-btn:hover:not(:disabled) {
          background: #d99a72;
        }

        .cc-btn:active:not(:disabled) {
          transform: scale(0.99);
        }

        .cc-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cc-footer-text {
          font-size: 13px;
          color: #524840;
          text-align: center;
          margin: 0 0 8px;
        }

        .cc-link {
          color: #c8865c;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .cc-link:hover {
          color: #d99a72;
        }

        .cc-back {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #3a342c;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.2s;
          margin-top: 4px;
        }

        .cc-back:hover { color: #7a7060; }

        .cc-msg-success {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          background: rgba(80, 160, 90, 0.15);
          border: 1px solid rgba(80, 160, 90, 0.3);
          color: #7ec88a;
        }

        .cc-msg-error {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          background: rgba(200, 80, 70, 0.15);
          border: 1px solid rgba(200, 80, 70, 0.3);
          color: #e08878;
        }
      `}</style>

      <div className="cc-page">
        {/* Dekoratif arka plan halkalar */}
        <svg
          style={{ position: 'absolute', top: 24, right: -12, opacity: 0.06, pointerEvents: 'none' }}
          width="180" height="180" viewBox="0 0 180 180" fill="none"
        >
          <circle cx="90" cy="90" r="80" stroke="#c8865c" strokeWidth="0.5"/>
          <circle cx="90" cy="90" r="55" stroke="#c8865c" strokeWidth="0.5"/>
          <circle cx="90" cy="90" r="30" stroke="#c8865c" strokeWidth="0.5"/>
          <line x1="10" y1="90" x2="170" y2="90" stroke="#c8865c" strokeWidth="0.5"/>
          <line x1="90" y1="10" x2="90" y2="170" stroke="#c8865c" strokeWidth="0.5"/>
        </svg>

        <div className="cc-card">
          {/* Logo */}
          <a href="/" className="cc-logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="rgba(200,134,92,0.15)"/>
              <circle cx="14" cy="14" r="5" fill="#c8865c"/>
              <circle cx="24" cy="12" r="3.5" fill="#a06090"/>
              <circle cx="22" cy="23" r="4" fill="#6090b0"/>
              <circle cx="13" cy="23" r="2.5" fill="#80a050"/>
              <rect x="17" y="16" width="1.5" height="7" rx="0.75" fill="rgba(200,134,92,0.6)" transform="rotate(-15 17 16)"/>
            </svg>
            <span className="cc-logo-text">Concept Corner</span>
          </a>

          {/* Başlık */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 className="cc-title">
              Aramıza<br /><em>katıl.</em>
            </h1>
            <div className="cc-divider" />
            <p className="cc-subtitle">Yaratıcılar için bir köşe</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ marginBottom: '1.2rem' }}>
              <label className="cc-label">Kullanıcı Adı</label>
              <input
                type="text"
                className="cc-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="isminiz veya takma adınız"
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label className="cc-label">E-posta</label>
              <input
                type="email"
                className="cc-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@mail.com"
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label className="cc-label">Şifre</label>
              <input
                type="password"
                className="cc-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
              <p className="cc-hint">En az 6 karakter</p>
            </div>

            {message && (
              <div className={isSuccess ? 'cc-msg-success' : 'cc-msg-error'} style={{ marginBottom: '1rem' }}>
                {message}
              </div>
            )}

            <button type="submit" className="cc-btn" disabled={loading}>
              {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: '1.8rem', textAlign: 'center' }}>
            <p className="cc-footer-text">
              Zaten hesabınız var mı?{' '}
              <a href="/auth/login" className="cc-link">Giriş yapın</a>
            </p>
            <a href="/" className="cc-back">← Ana sayfaya dön</a>
          </div>
        </div>
      </div>
    </>
  )
}
