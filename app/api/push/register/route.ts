import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Registers (or refreshes) a device push token for the signed-in user.
export async function POST(request: Request) {
  let body: { token?: string; platform?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token?.trim()
  const platform = body.platform?.trim()

  if (!token || !platform || !['android', 'ios', 'web'].includes(platform)) {
    return NextResponse.json({ ok: false, error: 'token and valid platform are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  // Upsert on the unique token: if the same device re-registers, refresh its
  // owner/platform/timestamp instead of creating duplicates.
  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userData.user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    )

  if (error) {
    console.error('[v0] push register error:', error.message)
    return NextResponse.json({ ok: false, error: 'Failed to register device' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Removes a device token (e.g. on logout or when push is disabled).
export async function DELETE(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ ok: false, error: 'token is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('token', token)

  if (error) {
    console.error('[v0] push unregister error:', error.message)
    return NextResponse.json({ ok: false, error: 'Failed to unregister device' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
