import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, requireAdminOrBusinessOwner, isAuthError } from '@/lib/auth-guard'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const resetLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 })

export async function POST(request: NextRequest) {
  const callerCheck = await requireAuth(request)
  if (isAuthError(callerCheck)) return callerCheck
  const auth =
    callerCheck.profile.role === 'admin'
      ? callerCheck
      : await requireAdminOrBusinessOwner(request, callerCheck.profile.business_id)
  if (isAuthError(auth)) return auth

  const ip = getClientIp(request)
  const limit = resetLimiter.check(ip)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    if (auth.profile.role !== 'admin') {
      const { data: target } = await supabaseAdmin
        .from('profiles')
        .select('role, business_id')
        .eq('id', userId)
        .maybeSingle<{ role: string; business_id: string | null }>()
      if (!target || target.role !== 'business' || target.business_id !== auth.profile.business_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Update user password using admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      console.error('Error resetting password:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
