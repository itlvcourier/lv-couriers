import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()

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
