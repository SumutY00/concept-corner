import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Giriş yapmalısın' }, { status: 401 })
  }

  const { following_id, action } = await request.json()

  if (!following_id) {
    return NextResponse.json({ error: 'following_id gerekli' }, { status: 400 })
  }

  if (user.id === following_id) {
    return NextResponse.json({ error: 'Kendini takip edemezsin' }, { status: 400 })
  }

  if (action === 'unfollow') {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', following_id)

    return NextResponse.json({ success: true, action: 'unfollowed' })
  }

  if (action === 'follow') {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id })

    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await supabase.from('notifications').insert({
      user_id: following_id,
      actor_id: user.id,
      type: 'follow',
      message: 'seni takip etmeye başladı',
    })
    return NextResponse.json({ success: true, action: 'followed' })
  }

  if (action === 'request') {
    // Insert into follow_requests (ignore duplicate)
    const { error } = await supabase
      .from('follow_requests')
      .insert({ requester_id: user.id, target_id: following_id, status: 'pending' })

    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send follow_request notification
    await supabase.from('notifications').insert({
      user_id: following_id,
      actor_id: user.id,
      type: 'follow_request',
      message: 'seni takip etmek istiyor',
    })

    return NextResponse.json({ success: true, action: 'requested' })
  }

  if (action === 'cancel_request') {
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', user.id)
      .eq('target_id', following_id)

    // Remove the notification too
    await supabase
      .from('notifications')
      .delete()
      .eq('actor_id', user.id)
      .eq('user_id', following_id)
      .eq('type', 'follow_request')

    return NextResponse.json({ success: true, action: 'cancelled' })
  }

  if (action === 'accept_request') {
    // Accept: move from follow_requests → follows
    await supabase
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('requester_id', user.id)
      .eq('target_id', following_id)

    // Actually insert into follows
    await supabase
      .from('follows')
      .insert({ follower_id: following_id, following_id: user.id })

    // Clean up the request
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', following_id)
      .eq('target_id', user.id)

    // Notify requester that their request was accepted
    await supabase.from('notifications').insert({
      user_id: following_id,
      actor_id: user.id,
      type: 'follow',
      message: 'takip isteğini kabul etti',
    })

    return NextResponse.json({ success: true, action: 'accepted' })
  }

  if (action === 'reject_request') {
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', following_id)
      .eq('target_id', user.id)

    return NextResponse.json({ success: true, action: 'rejected' })
  }

  return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })
}
