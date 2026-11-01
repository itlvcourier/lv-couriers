import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const pinLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth

  const limited = pinLimiter.check(`verify-pin:${id}`)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Ask the recipient to check their tracking link, or contact dispatch.' }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as { pin?: string } | null
  const pin = String(body?.pin ?? '').replace(/\D/g, '')
  if (pin.length !== 4) return NextResponse.json({ error: 'Enter the 4-digit PIN' }, { status: 400 })

  // Attempts are counted in the row itself so the 5-try lockout holds across
  // every serverless instance, not just this one.
  const db = createAdminClient()
  const { data: result, error } = await db.rpc('verify_delivery_pin', { p_delivery: id, p_pin: pin })
  if (error) return NextResponse.json({ error: 'PIN could not be checked. Try again.' }, { status: 500 })

  switch (result as string) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'not_required':
      return NextResponse.json({ ok: true, notRequired: true })
    case 'not_found':
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    case 'locked':
      return NextResponse.json(
        { error: 'PIN locked after 5 wrong tries. Contact dispatch to complete this delivery.' },
        { status: 423 },
      )
    default:
      return NextResponse.json({ error: 'PIN does not match' }, { status: 400 })
  }
}
