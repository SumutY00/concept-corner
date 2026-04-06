'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage('Giriş başarısız: ' + error.message)
      setIsSuccess(false)
      setLoading(false)
    } else {
      setIsSuccess(true)
      setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
      router.push('/')
      router.refresh()
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setMessage('Google ile giriş başarısız: ' + error.message)
      setIsSuccess(false)
      setGoogleLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* Sol panel — dekoratif */
        .login-left {
          flex: 1;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }

        .login-left::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
        }

        .login-left::after {
          content: '';
          position: absolute;
          bottom: -60px; left: -60px;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
        }

        .login-left-content {
          position: relative;
          z-index: 1;
          text-align: center;
          color: #fff;
          max-width: 360px;
        }

        .login-left-logo {
          width: 64px; height: 64px;
          background: rgba(255,255,255,0.15);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.5rem;
          backdrop-filter: blur(10px);
        }

        .login-left h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 0.8rem;
          line-height: 1.3;
        }

        .login-left p {
          font-size: 15px;
          font-weight: 300;
          opacity: 0.85;
          line-height: 1.6;
        }

        .login-dots {
          display: flex;
          gap: 8px;
          margin-top: 2rem;
          justify-content: center;
        }

        .login-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
        }

        .login-dot.active {
          background: #fff;
          width: 24px;
          border-radius: 4px;
        }

        /* Sağ panel — form */
        .login-right {
          flex: 1;
          background: #fafbfc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
        }

        .login-welcome {
          font-size: 26px;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 6px;
        }

        .login-subtitle {
          font-size: 14px;
          color: #8e8ea0;
          font-weight: 400;
          margin-bottom: 2rem;
        }

        /* Google butonu */
        .login-google-btn {
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

        .login-google-btn:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #d0d5dd;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .login-google-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Ayırıcı */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 1.5rem 0;
        }

        .login-divider-line {
          flex: 1;
          height: 1px;
          background: #e8e8ed;
        }

        .login-divider-text {
          font-size: 12px;
          color: #b0b0c0;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Form alanları */
        .login-field {
          margin-bottom: 1rem;
        }

        .login-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #4a4a5a;
          margin-bottom: 6px;
        }

        .login-input {
          width: 100%;
          box-sizing: border-box;
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

        .login-input::placeholder {
          color: #c0c0d0;
        }

        .login-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
        }

        /* Giriş butonu */
        .login-submit {
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

        .login-submit:hover:not(:disabled) {
          opacity: 0.92;
        }

        .login-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .login-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Mesajlar */
        .login-msg-success {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          margin-bottom: 1rem;
        }

        .login-msg-error {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          margin-bottom: 1rem;
        }

        /* Footer */
        .login-footer {
          text-align: center;
          margin-top: 1.8rem;
        }

        .login-footer-text {
          font-size: 14px;
          color: #8e8ea0;
        }

        .login-footer-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .login-footer-link:hover {
          color: #764ba2;
        }

        .login-back {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #b0b0c0;
          text-decoration: none;
          margin-top: 10px;
          transition: color 0.2s;
        }

        .login-back:hover {
          color: #667eea;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .login-page { flex-direction: column; }
          .login-left { display: none; }
          .login-right { padding: 2rem 1.5rem; min-height: 100vh; }
        }
      `}</style>

      <div className="login-page">
        {/* Sol dekoratif panel */}
        <div className="login-left">
          <div className="login-left-content">
            <div className="login-left-logo">
              <img src="/logo.png" alt="Concept Corner" style={{ height: 56, width: 'auto' }} />
            </div>
            <h2>Yaratıcılığını<br/>keşfet ve paylaş</h2>
            <p>Konseptlerini oluştur, ilham al ve yaratıcı topluluğun bir parçası ol.</p>
            <div className="login-dots">
              <div className="login-dot active" />
              <div className="login-dot" />
              <div className="login-dot" />
            </div>
          </div>
        </div>

        {/* Sağ form paneli */}
        <div className="login-right">
          <div className="login-card">
            <h1 className="login-welcome">Tekrar hoş geldin 👋</h1>
            <p className="login-subtitle">Hesabına giriş yap ve keşfetmeye devam et</p>

            {/* Google ile giriş */}
            <button
              className="login-google-btn"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Yönlendiriliyorsunuz...' : 'Google ile devam et'}
            </button>

            {/* Ayırıcı */}
            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">veya e-posta ile</span>
              <div className="login-divider-line" />
            </div>

            {/* Email/Şifre formu */}
            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label className="login-label">E-posta</label>
                <input
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@mail.com"
                />
              </div>

              <div className="login-field">
                <label className="login-label">Şifre</label>
                <input
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <div className={isSuccess ? 'login-msg-success' : 'login-msg-error'}>
                  {message}
                </div>
              )}

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

            {/* Footer */}
            <div className="login-footer">
              <p className="login-footer-text">
                Hesabın yok mu?{' '}
                <a href="/auth/signup" className="login-footer-link">Kayıt ol</a>
              </p>
              <a href="/" className="login-back">← Ana sayfaya dön</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
