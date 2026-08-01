import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (isAuthError(auth)) return auth

  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Delete from profiles table first (role source of truth)
    const { error: dbError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (dbError) {
      console.error('Error deleting user record:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }
    
    // Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (authError) {
      console.error('Error deleting auth user:', authError)
      // User record already deleted, continue
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete admin user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
