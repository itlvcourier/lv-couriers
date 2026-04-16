import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client for server-only usage (cron jobs, server actions).
 * Uses the SUPABASE_SERVICE_ROLE_KEY so RLS is bypassed.
 *
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
