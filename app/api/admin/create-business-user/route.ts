import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic - this route requires runtime env vars
export const dynamic = 'force-dynamic'

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  
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
    // IMPORTANT: Keys must match what mockUserFromAuthUser expects (snake_case)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'business',
        business_id: businessId,
        location_id: role === 'owner' ? null : locationId, // Owners don't have a specific location
        business_role: role,
        full_name: name || email.split('@')[0],
      },
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Store ALL business users in profiles table
    if (authData.user) {
      // Create/update the profile record with only columns that exist
      // Note: business_role and managed_location_ids may not exist in all schemas
      // We use location_id to determine role: null = owner, set = manager
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email,
          full_name: name || email.split('@')[0],
          role: 'business',
          business_id: businessId,
          location_id: role === 'owner' ? null : locationId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.error('Error storing profile:', profileError)
        // Don't fail - user was created in auth, profile insert might fail due to schema
      }

      // If not owner, also create location assignment records
      if (role !== 'owner' && locationId) {
        const { error: locationError } = await supabaseAdmin
          .from('business_user_locations')
          .upsert({
            user_id: authData.user.id,
            business_id: businessId,
            location_id: locationId,
            created_at: new Date().toISOString(),
          })

        if (locationError) {
          console.error('Error storing location assignment:', locationError)
        }
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
