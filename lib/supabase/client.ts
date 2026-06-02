import { createBrowserClient } from '@supabase/ssr'

// Singleton so repeated calls share the same auth/session state across the app.
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  // Guard against SSR prerendering when env vars aren't available
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !anonKey) {
    // During SSR prerendering, return a mock client that will be replaced on hydration
    if (typeof window === 'undefined') {
      return null as unknown as ReturnType<typeof createBrowserClient>
    }
    throw new Error('Supabase URL and Anon Key are required')
  }

  // Use the library defaults — @supabase/ssr's built-in cookie adapter handles
  // both the v0 preview sandbox and production deployments without custom
  // cookieOptions. Adding custom cookieOptions (without the matching adapter)
  // was previously breaking session persistence after signInWithPassword.
  client = createBrowserClient(url, anonKey)

  return client
}
