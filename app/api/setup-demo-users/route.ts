import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return Response.json(
        { error: 'Missing Supabase environment variables. Please ensure SUPABASE_SERVICE_ROLE_KEY is set.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create demo users using Admin API
    const demoUsers = [
      {
        email: 'business@demo.lvcouriers.com',
        password: 'Demo@123',
        user_metadata: { role: 'business', name: 'Demo Business' },
      },
      {
        email: 'driver@demo.lvcouriers.com',
        password: 'Demo@123',
        user_metadata: { role: 'driver', name: 'Demo Driver' },
      },
      {
        email: 'admin@demo.lvcouriers.com',
        password: 'Demo@123',
        user_metadata: { role: 'admin', name: 'Admin User' },
      },
    ]

    const results = []

    for (const user of demoUsers) {
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          user_metadata: user.user_metadata,
          email_confirm: true,
        })

        if (error) {
          results.push({
            email: user.email,
            success: false,
            error: error.message,
          })
        } else {
          results.push({
            email: user.email,
            success: true,
            userId: data.user?.id,
          })
        }
      } catch (err: any) {
        results.push({
          email: user.email,
          success: false,
          error: err.message,
        })
      }
    }

    return Response.json({
      message: 'Demo users setup complete',
      results,
    })
  } catch (error: any) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 }
    )
  }
}
