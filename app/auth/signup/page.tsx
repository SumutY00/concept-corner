'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
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

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage('Google ile kayıt başarısız: ' + error.message)
      setIsSuccess(false)
      setGoogleLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
        }

        .signup-page {
          min-height: 100vh;
          display: flex;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* Sol panel */
        .signup-left {
          flex: 1;
          background: linear-gradient(135deg, #7b52b3 0%, #6f6fe8 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }

        .signup-left::before {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
        }

        .signup-left::after {
          content: '';
          position: absolute;
          bottom: -140px;
          left: -140px;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.07);
        }

        .signup-left-content {
          position: relative;
          z-index: 1;
          text-align: center;
          color: #fff;
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .signup-left-logo {
          width: min(480px, 95%);
          margin: 0 auto 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .signup-left-logo img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 16px 34px rgba(0, 0, 0, 0.16));
        }

        .signup-left h2 {
          font-size: 42px;
          font-weight: 800;
          margin: 0 0 1rem;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .signup-left p {
          font-size: 18px;
          font-weight: 400;
          opacity: 0.92;
          line-height: 1.7;
          margin: 0 0 2rem;
          max-width: 520px;
        }

        .signup-feature-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: flex-start;
          text-align: left;
          width: fit-content;
        }

        .signup-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255, 255, 255, 0.96);
          font-size: 18px;
          font-weight: 500;
        }

        .signup-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(10px);
          flex-shrink: 0;
          font-size: 16px;
        }

        /* Sağ panel */
        .signup-right {
          flex: 1;
          background: #fafbfc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
        }

        .signup-card {
          width: 100%;
          max-width: 400px;
        }

        .signup-welcome {
          font-size: 26px;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 6px;
        }

        .signup-subtitle {
          font-size: 14px;
          color: #8e8ea0;
          font-weight: 400;
          margin-bottom: 2rem;
        }

        .signup-google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fff;
          border: 1.5px solid #e2e4e9;
          border-radius: 12px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #3c4043;
          cursor: pointer;
          transition: all 0.2s;
        }

        .signup-google-btn:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #d0d5dd;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .signup-google-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .signup-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 1.5rem 0;
        }

        .signup-divider-line {
          flex: 1;
          height: 1px;
          background: #e8e8ed;
        }

        .signup-divider-text {
          font-size: 12px;
          color: #b0b0c0;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .signup-field {
          margin-bottom: 1rem;
        }

        .signup-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #4a4a5a;
          margin-bottom: 6px;
        }

        .signup-input {
          width: 100%;
          padding: 12px 14px;
          background: #fff;
          border: 1.5px solid #e2e4e9;
          border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px;
          color: #1a1a2e;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .signup-input::placeholder {
          color: #c0c0d0;
        }

        .signup-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
        }

        .signup-hint {
          font-size: 12px;
          color: #b0b0c0;
          margin-top: 4px;
        }

        .signup-submit {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          margin-top: 0.5rem;
        }

        .signup-submit:hover:not(:disabled) {
          opacity: 0.92;
        }

        .signup-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .signup-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .signup-msg-success {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          margin-bottom: 1rem;
        }

        .signup-msg-error {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          margin-bottom: 1rem;
        }

        .signup-footer {
          text-align: center;
          margin-top: 1.8rem;
        }

        .signup-footer-text {
          font-size: 14px;
          color: #8e8ea0;
        }

        .signup-footer-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .signup-footer-link:hover {
          color: #764ba2;
        }

        .signup-back {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #b0b0c0;
          text-decoration: none;
          margin-top: 10px;
          transition: color 0.2s;
        }

        .signup-back:hover {
          color: #667eea;
        }

        @media (max-width: 1024px) {
          .signup-left h2 {
            font-size: 34px;
          }

          .signup-left p {
            font-size: 16px;
          }

          .signup-feature-item {
            font-size: 16px;
          }

          .signup-left-logo {
            width: min(360px, 92%);
          }
        }

        @media (max-width: 768px) {
          .signup-page {
            flex-direction: column;
          }

          .signup-left {
            display: none;
          }

          .signup-right {
            padding: 2rem 1.5rem;
            min-height: 100vh;
          }
        }
      `}</style>

      <div className="signup-page">
        <div className="signup-left">
          <div className="signup-left-content">
            <div className="signup-left-logo">
              <img src="/logo.png" alt="Concept Corner" />
            </div>

            <h2>
              Yaratıcı topluluğa
              <br />
              katıl
            </h2>

            <p>
              Binlerce yaratıcıyla birlikte konseptlerini paylaş ve ilham al.
            </p>

            <div className="signup-feature-list">
              <div className="signup-feature-item">
                <div className="signup-feature-icon">🎨</div>
                <span>Konseptlerini oluştur ve paylaş</span>
              </div>

              <div className="signup-feature-item">
                <div className="signup-feature-icon">🏆</div>
                <span>Rozetler kazan, skor tablosunda yüksel</span>
              </div>

              <div className="signup-feature-item">
                <div className="signup-feature-icon">💬</div>
                <span>Yaratıcılarla etkileşime geç</span>
              </div>
            </div>
          </div>
        </div>

        <div className="signup-right">
          <div className="signup-card">
            <h1 className="signup-welcome">Hesap oluştur ✨</h1>
            <p className="signup-subtitle">Hemen ücretsiz kayıt ol ve keşfetmeye başla</p>

            <button
              className="signup-google-btn"
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? 'Yönlendiriliyorsunuz...' : 'Google ile devam et'}
            </button>

            <div className="signup-divider">
              <div className="signup-divider-line" />
              <span className="signup-divider-text">veya e-posta ile</span>
              <div className="signup-divider-line" />
            </div>

            <form onSubmit={handleSignup}>
              <div className="signup-field">
                <label className="signup-label">Kullanıcı Adı</label>
                <input
                  type="text"
                  className="signup-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="isminiz veya takma adınız"
                />
              </div>

              <div className="signup-field">
                <label className="signup-label">E-posta</label>
                <input
                  type="email"
                  className="signup-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@mail.com"
                />
              </div>

              <div className="signup-field">
                <label className="signup-label">Şifre</label>
                <input
                  type="password"
                  className="signup-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
                <p className="signup-hint">En az 6 karakter</p>
              </div>

              {message && (
                <div className={isSuccess ? 'signup-msg-success' : 'signup-msg-error'}>
                  {message}
                </div>
              )}

              <button type="submit" className="signup-submit" disabled={loading}>
                {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
              </button>
            </form>

            <div className="signup-footer">
              <p className="signup-footer-text">
                Zaten hesabın var mı?{' '}
                <a href="/auth/login" className="signup-footer-link">
                  Giriş yap
                </a>
              </p>
              <a href="/" className="signup-back">
                ← Ana sayfaya dön
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}