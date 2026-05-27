import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use service role to create users (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { email, password, name, businessId, locationId, role } = await request.json()

    if (!email || !password || !businessId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, businessId, role' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['owner', 'manager', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be owner, manager, or viewer' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth with metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'business',
        businessId,
        locationId: role === 'owner' ? null : locationId, // Owners don't have a specific location
        businessRole: role,
        name: name || email.split('@')[0],
      },
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // If not owner, also store in business_users table for location access tracking
    if (role !== 'owner' && authData.user) {
      const { error: dbError } = await supabaseAdmin
        .from('business_users')
        .insert({
          user_id: authData.user.id,
          business_id: businessId,
          email,
          name: name || email.split('@')[0],
          business_role: role,
          managed_location_ids: locationId ? [locationId] : [],
          created_at: new Date().toISOString(),
        })

      if (dbError) {
        console.error('Error storing business user:', dbError)
        // User was created but DB record failed - not critical
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        role,
        businessId,
        locationId: role === 'owner' ? null : locationId,
      },
    })
  } catch (error) {
    console.error('Create business user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
