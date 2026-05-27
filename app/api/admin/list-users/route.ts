import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user to verify they're admin
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin (from user metadata)
    const isAdmin = user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Note: To list all users, you need to use the Supabase Admin API
    // which requires a service role key. For now, we'll return info based on
    // what's available in the auth system.
    
    // For a simple implementation, we can return the current admin user
    // Full user listing requires supabase-admin client with service_role key
    
    // Return current user as admin (simplified)
    const adminUsers = [{
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Admin',
      role: 'admin',
      created_at: user.created_at,
    }]
    
    return NextResponse.json(adminUsers)
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Failed to fetch admin users' }, { status: 500 })
  }
}
