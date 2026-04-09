'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const [visible, setVisible] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const lastScrollY = useRef(0)
  const pathname = usePathname()

  // Auth sayfalarında gösterme
  const hideOnPages = ['/auth/login', '/auth/signup', '/auth/callback']
  const shouldHide = hideOnPages.some(p => pathname.startsWith(p))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('users').select('username').eq('id', user.id).single()
          .then(({ data }) => { if (data) setUsername(data.username) })
      }
    })
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      if (currentY > lastScrollY.current && currentY > 80) {
        setVisible(false) // aşağı scroll → gizle
      } else {
        setVisible(true) // yukarı scroll → göster
      }
      lastScrollY.current = currentY
    }

    // Scroll durduğunda göster
    let scrollTimer: NodeJS.Timeout
    const handleScrollEnd = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setVisible(true), 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('scroll', handleScrollEnd, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('scroll', handleScrollEnd)
      clearTimeout(scrollTimer)
    }
  }, [])

  if (shouldHide || !user) return null

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  return (
    <>
      <style>{`
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: rgba(10, 10, 18, 0.92);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255,255,255,0.08);
            padding: 6px 0 env(safe-area-inset-bottom, 8px);
            justify-content: space-around;
            align-items: center;
            transition: transform 0.3s ease;
          }

          .bottom-nav.hidden {
            transform: translateY(100%);
          }

          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 12px;
            transition: all 0.2s;
            position: relative;
          }

          .bottom-nav-item svg {
            width: 24px;
            height: 24px;
            transition: all 0.2s;
          }

          .bottom-nav-label {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 10px;
            font-weight: 500;
            transition: color 0.2s;
            color: rgba(255,255,255,0.4);
          }

          .bottom-nav-item.active .bottom-nav-label {
            color: #667eea;
          }

          .bottom-nav-item.active svg {
            filter: drop-shadow(0 0 6px rgba(102,126,234,0.4));
          }

          /* Paylaş butonu — ortada büyük */
          .bottom-nav-create {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            box-shadow: 0 4px 15px rgba(102,126,234,0.4);
            margin-top: -16px;
            transition: transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
          }

          .bottom-nav-create:active {
            transform: scale(0.92);
          }

          .bottom-nav-create svg {
            width: 24px;
            height: 24px;
          }

          /* Sayfa altında padding ekle ki bottom nav içeriği kapatmasın */
          body {
            padding-bottom: 72px;
          }

          /* Ayarlar mini butonu — profil ikonu üzerine */
          .bottom-nav-settings-badge {
            position: absolute;
            top: -2px;
            right: 4px;
            width: 18px;
            height: 18px;
            background: var(--cc-gradient, linear-gradient(135deg, #667eea, #764ba2));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            border: 1.5px solid rgba(10,10,18,0.92);
            animation: badgePop 0.2s ease;
          }

          @keyframes badgePop {
            from { transform: scale(0.5); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>

      <nav className={`bottom-nav ${visible ? '' : 'hidden'}`}>
        {/* Ana Sayfa */}
        <a href="/" className={`bottom-nav-item ${isActive('/') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke={isActive('/') ? '#667eea' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="bottom-nav-label">Ana Sayfa</span>
        </a>

        {/* Keşfet */}
        <a href="/explore" className={`bottom-nav-item ${isActive('/explore') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke={isActive('/explore') ? '#667eea' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
          <span className="bottom-nav-label">Keşfet</span>
        </a>

        {/* Paylaş — ortada büyük */}
        <a href="/post/new" className="bottom-nav-create">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </a>

        {/* Bildirimler */}
        <a href="/notifications" className={`bottom-nav-item ${isActive('/notifications') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke={isActive('/notifications') ? '#667eea' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="bottom-nav-label">Bildirim</span>
        </a>

        {/* Profil */}
        <a href={username ? `/profile/${username}` : '/auth/login'} className={`bottom-nav-item ${isActive('/profile') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke={isActive('/profile') ? '#667eea' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="bottom-nav-label">Profil</span>
          {username && isActive('/profile') && (
            <a href="/settings" className="bottom-nav-settings-badge" title="Ayarlar"
               onClick={e => e.stopPropagation()}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </a>
          )}
        </a>
      </nav>
    </>
  )
}
