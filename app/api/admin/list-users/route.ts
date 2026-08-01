import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (isAuthError(auth)) return auth

  try {
    const supabase = createAdminClient()

    // Fetch all admin profiles from the DB (authoritative — not user_metadata)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const adminUsers = (data || []).map(p => ({
      id: p.id,
      email: p.email || '',
      name: p.full_name || p.email?.split('@')[0] || 'Admin',
      role: 'admin',
      created_at: p.created_at,
    }))

    return NextResponse.json(adminUsers)
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Failed to fetch admin users' }, { status: 500 })
  }
}
