'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      // URL'deki code parametresini al (PKCE flow)
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        // Kodu session'a çevir
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('OAuth hata:', error)
          router.push('/auth/login')
          return
        }
      }

      // Session'ı kontrol et
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Kullanıcının users tablosunda kaydı var mı kontrol et
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .single()

        if (!existingUser) {
          // Yeni kullanıcı — users tablosuna ekle
          const email = session.user.email ?? ''
          const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 1000)

          await supabase.from('users').insert({
            id: session.user.id,
            email: email,
            username: username,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
          })
        }

        router.push('/')
        router.refresh()
      } else {
        router.push('/auth/login')
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
        <p style={{ color: 'var(--cc-text-muted)', fontSize: 14 }}>Giriş yapılıyor...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}