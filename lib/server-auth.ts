'use server'

import { createClient } from '@supabase/supabase-js'

// Server actions - all must be async per Next.js requirements
export async function generateTemporaryPassword(): Promise<string> {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
}

export async function inviteDriver(
  email: string,
  name: string,
  phone: string,
): Promise<{ error?: string; tempPassword?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return { error: 'Missing Supabase environment variables' }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const tempPassword = await generateTemporaryPassword()

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, role: 'driver' }
    })

    if (authError) {
      return { error: authError.message }
    }

    if (!authData.user) {
      return { error: 'Failed to create user' }
    }

    // Create driver profile
    const { error: profileError } = await supabase
      .from('drivers')
      .insert({
        id: authData.user.id,
        name,
        email,
        phone,
        status: 'offline',
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }

    return { tempPassword }
  } catch (err) {
    console.error('Invite driver error:', err)
    return { error: 'Failed to invite driver' }
  }
}
