/**
 * auth-guard.ts
 *
 * Server-side auth helpers used by API route handlers.
 *
 * - requireAuth   → any signed-in user
 * - requireAdmin  → signed-in user whose profiles.role = 'admin' (DB-authoritative)
 *
 * Both return { user, profile } on success or a ready-to-return NextResponse on
 * failure.  The caller should check with isAuthError() before proceeding.
 *
 * Usage:
 *   const result = await requireAdmin(req)
 *   if (isAuthError(result)) return result          // short-circuit
 *   const { user, profile } = result
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AuthUser {
  user: { id: string; email: string | undefined }
  profile: { id: string; role: string; business_id: string | null }
}

export type AuthResult = AuthUser | NextResponse

/** Narrow-guard: is the result an error response? */
export function isAuthError(result: AuthResult): result is NextResponse {
  return result instanceof NextResponse
}

/**
 * Verify the caller is any authenticated user.
 * Reads the session cookie via the SSR client (anon key + cookie).
 */
export async function requireAuth(_req: NextRequest): Promise<AuthResult> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the authoritative profile row
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, business_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return {
      user: { id: user.id, email: user.email },
      profile: profile as AuthUser['profile'],
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

/**
 * Verify the caller is an authenticated admin.
 * Reads role from profiles table — never user_metadata (client-writable).
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await requireAuth(req)
  if (isAuthError(result)) return result

  if (result.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result
}

/**
 * Verify the caller is a party to a specific delivery: an admin, the driver
 * assigned to it, or the business that owns it. Used by delivery-scoped SMS
 * routes so drivers/businesses can trigger notifications for their own jobs
 * without being able to fire texts for anyone else's delivery.
 */
export async function requireDeliveryParty(
  req: NextRequest,
  deliveryId: string | undefined | null,
): Promise<AuthResult> {
  const result = await requireAuth(req)
  if (isAuthError(result)) return result
  if (result.profile.role === 'admin') return result
  if (!deliveryId) {
    return NextResponse.json({ error: 'deliveryId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from('deliveries')
    .select('driver_id, business_id')
    .eq('id', deliveryId)
    .maybeSingle<{ driver_id: string | null; business_id: string | null }>()

  if (!delivery) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (
    result.profile.business_id &&
    delivery.business_id === result.profile.business_id
  ) {
    return result
  }

  if (delivery.driver_id) {
    const { data: driver } = await admin
      .from('drivers')
      .select('id')
      .eq('id', delivery.driver_id)
      .eq('user_id', result.user.id)
      .maybeSingle()
    if (driver) return result
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
