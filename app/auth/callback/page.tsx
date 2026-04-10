'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState('Giriş yapılıyor...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Hem hash hem code parametrelerini kontrol et
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const urlParams = new URLSearchParams(window.location.search)

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const code = urlParams.get('code')

        if (accessToken && refreshToken) {
          // Implicit flow — hash'ten token al
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        } else if (code) {
          // PKCE flow — code exchange
          await supabase.auth.exchangeCodeForSession(code)
        } else {
          // Token yok, auth event dinle
          await new Promise<void>((resolve) => {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
              if (event === 'SIGNED_IN') {
                subscription.unsubscribe()
                resolve()
              }
            })
            // 5 saniye timeout
            setTimeout(() => {
              subscription.unsubscribe()
              resolve()
            }, 5000)
          })
        }

        // Session kontrol
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          setStatus('Hesap kontrol ediliyor...')

          // Users tablosunda var mı?
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', session.user.id)
            .single()

          if (!existingUser) {
            setStatus('Hesap oluşturuluyor...')
            const email = session.user.email ?? ''
            const name = session.user.user_metadata?.full_name ?? ''
            const username = (name || email.split('@')[0])
              .replace(/[^a-zA-Z0-9]/g, '')
              .toLowerCase() + Math.floor(Math.random() * 1000)

            await supabase.from('users').insert({
              id: session.user.id,
              email: email,
              username: username,
              avatar_url: session.user.user_metadata?.avatar_url ?? null,
              bio: null,
            })
          }

          setStatus('Yönlendiriliyorsunuz...')
          window.location.href = '/'
        } else {
          setStatus('Giriş başarısız, yönlendiriliyorsunuz...')
          setTimeout(() => router.push('/auth/login'), 2000)
        }
      } catch (err) {
        console.error('Callback hatası:', err)
        setStatus('Bir hata oluştu, yönlendiriliyorsunuz...')
        setTimeout(() => router.push('/auth/login'), 2000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cc-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid var(--cc-border)',
          borderTopColor: '#667eea',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: 'var(--cc-text-muted)', fontSize: 14 }}>{status}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}