import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      const role = data.user.user_metadata?.role || 'business'
      
      // Redirect based on role
      let redirectPath = '/business'
      switch (role) {
        case 'driver':
          redirectPath = '/driver'
          break
        case 'admin':
          redirectPath = '/admin'
          break
        case 'business':
        default:
          redirectPath = '/business'
          break
      }
      
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`)
}
