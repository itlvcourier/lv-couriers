import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify requester is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { userId } = await req.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }
    
    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }
    
    const adminClient = createAdminClient()
    
    // Delete from users table first
    const { error: dbError } = await adminClient
      .from('users')
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
