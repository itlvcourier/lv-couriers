import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
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

  const db = createAdminClient()
  const { data: d } = await db
    .from('deliveries')
    .select('require_pin, delivery_pin')
    .eq('id', id)
    .maybeSingle<{ require_pin: boolean; delivery_pin: string | null }>()
  if (!d?.require_pin || !d.delivery_pin) return NextResponse.json({ ok: true, notRequired: true })

  const match = d.delivery_pin.length === pin.length && timingSafeEqual(Buffer.from(d.delivery_pin), Buffer.from(pin))
  if (!match) return NextResponse.json({ error: 'PIN does not match' }, { status: 400 })

  await db.from('deliveries').update({ pin_verified_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
