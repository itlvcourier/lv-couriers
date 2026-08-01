import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // If this is a password recovery flow, always redirect to reset-password.
      // The `next` param may already say /reset-password but we enforce it here
      // regardless so the token is live in the session before the page renders.
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      
      // Otherwise redirect to the intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
