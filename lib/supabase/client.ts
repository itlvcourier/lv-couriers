import { createBrowserClient } from '@supabase/ssr'

// Singleton so repeated calls share the same auth/session state across the app.
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  // Use the library defaults — @supabase/ssr's built-in cookie adapter handles
  // both the v0 preview sandbox and production deployments without custom
  // cookieOptions. Adding custom cookieOptions (without the matching adapter)
  // was previously breaking session persistence after signInWithPassword.
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return client
}
