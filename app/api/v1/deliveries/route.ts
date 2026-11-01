import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { authenticateApiKey, createDelivery, listDeliveries, type ApiResult } from '@/lib/public-api'

export const dynamic = 'force-dynamic'

const limiter = rateLimit({ max: 120, windowMs: 60_000 })

function err(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { message, ...(code ? { code } : {}) } }, { status })
}

function respond<T>(r: ApiResult<T>) {
  if (!r.ok) return err(r.message, r.status, r.code)
  return NextResponse.json({ data: r.data, ...(r.replay ? { idempotent_replay: true } : {}) }, { status: r.status })
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return err('Invalid or missing API key', 401, 'unauthorized')
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429, 'rate_limited')

  const sp = req.nextUrl.searchParams
  return respond(
    await listDeliveries(auth, {
      id: sp.get('id'),
      tracking_code: sp.get('tracking_code'),
      status: sp.get('status'),
      limit: Number(sp.get('limit')) || null,
    }),
  )
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return err('Invalid or missing API key', 401, 'unauthorized')
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429, 'rate_limited')

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b !== 'object' || Array.isArray(b)) return err('Body must be JSON', 400, 'invalid_json')

  return respond(await createDelivery(auth, b, req.headers.get('idempotency-key')))
}
