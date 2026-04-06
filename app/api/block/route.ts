import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { blocked_id, action } = await request.json()
  if (!blocked_id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (blocked_id === user.id) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })

  if (action === 'unblock') {
    await supabase.from('blocks').delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blocked_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'block') {
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id })
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Engelleme sırasında takipleşmeyi de kaldır
    await supabase.from('follows').delete()
      .or(`and(follower_id.eq.${user.id},following_id.eq.${blocked_id}),and(follower_id.eq.${blocked_id},following_id.eq.${user.id})`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
