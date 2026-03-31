import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public paths that don't require auth
  const publicPaths = ['/auth/login', '/auth/signup', '/auth/signup-success', '/auth/error', '/auth/callback', '/auth/confirm']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  // Protected paths
  const protectedPaths = ['/driver', '/business', '/admin']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  // If user is not logged in and trying to access protected path
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and on auth pages, redirect to appropriate dashboard
  if (user && isPublicPath && pathname !== '/auth/callback' && pathname !== '/auth/confirm') {
    const role = user.user_metadata?.role || 'business'
    const url = request.nextUrl.clone()
    
    switch (role) {
      case 'driver':
        url.pathname = '/driver'
        break
      case 'admin':
        url.pathname = '/admin'
        break
      case 'business':
      default:
        url.pathname = '/business'
        break
    }
    return NextResponse.redirect(url)
  }

  // If user is logged in and on root path, redirect to appropriate dashboard
  if (user && pathname === '/') {
    const role = user.user_metadata?.role || 'business'
    const url = request.nextUrl.clone()
    
    switch (role) {
      case 'driver':
        url.pathname = '/driver'
        break
      case 'admin':
        url.pathname = '/admin'
        break
      case 'business':
      default:
        url.pathname = '/business'
        break
    }
    return NextResponse.redirect(url)
  }

  // If not logged in and on root, redirect to login
  if (!user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Role-based access control
  if (user && isProtectedPath) {
    const role = user.user_metadata?.role || 'business'
    const url = request.nextUrl.clone()

    // Check if user is accessing their allowed area
    if (pathname.startsWith('/driver') && role !== 'driver') {
      url.pathname = role === 'admin' ? '/admin' : '/business'
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith('/business') && role !== 'business') {
      url.pathname = role === 'admin' ? '/admin' : '/driver'
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      url.pathname = role === 'driver' ? '/driver' : '/business'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
