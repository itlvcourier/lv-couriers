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
      console.error('Error creating auth user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    
    // Create users table entry
    const { error: dbError } = await adminClient
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: 'admin',
      })
    
    if (dbError) {
      console.error('Error creating user record:', dbError)
      // Cleanup: delete auth user if db insert fails
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
