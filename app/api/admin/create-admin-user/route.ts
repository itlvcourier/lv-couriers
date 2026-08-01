import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const createAdminUserLimiter = rateLimit({ max: 5, windowMs: 60 * 60 * 1000 })

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (isAuthError(auth)) return auth

  const ip = getClientIp(req)
  const limit = createAdminUserLimiter.check(ip)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  try {
    const { email, name, password } = await req.json()
    
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    
    const adminClient = createAdminClient()

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create profiles row (authoritative role store — never user_metadata)
    const { error: dbError } = await adminClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name: name,
        role: 'admin',
      }, { onConflict: 'id' })
    
    if (dbError) {
      // Cleanup: delete auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true,
      user: { id: authData.user.id, email, name }
    })
  } catch (error) {
    console.error('Create admin user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
