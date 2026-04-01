import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateTemporaryPassword } from '@/lib/server-auth'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { driverEmail, driverName, driverPhone } = await req.json()

    if (!driverEmail || !driverName) {
      return NextResponse.json(
        { error: 'Missing required fields: driverEmail, driverName' },
        { status: 400 }
      )
    }

    // Generate temporary password
    const tempPassword = await generateTemporaryPassword()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: driverEmail,
      password: tempPassword,
      options: {
        data: {
          role: 'driver',
          name: driverName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback`,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 })
    }

    // Create driver record
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: authData.user.id,
        name: driverName,
        email: driverEmail,
        phone: driverPhone,
        status: 'available',
      })
      .select()
      .single()

    if (driverError) {
      return NextResponse.json({ error: driverError.message }, { status: 400 })
    }

    // TODO: Send email with credentials
    // For now, return the password so admin can manually share it
    return NextResponse.json({
      success: true,
      driver: driverData,
      credentials: {
        email: driverEmail,
        tempPassword,
      },
    })
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
