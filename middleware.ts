import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? ''

const protectedRoutes = [
  '/post/new',
  '/profile/edit',
  '/notifications',
  '/messages',
  '/settings',
]

const adminRoutes = [
  '/admin',
]

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) { response.cookies.set({ name, value, ...options }) },
        remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Giriş yapmamış kullanıcı korumalı sayfaya girmeye çalışıyor
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Admin sayfası koruması
  const isAdmin = adminRoutes.some(r => path.startsWith(r))
  if (isAdmin) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (ADMIN_EMAIL && user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/post/new',
    '/profile/edit',
    '/notifications',
    '/messages',
    '/messages/:path*',
    '/settings',
    '/admin/:path*',
  ],
}
