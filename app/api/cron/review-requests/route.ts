import { NextResponse } from 'next/server'
import { runReviewRequests } from '@/lib/sms-cron-jobs'

export const dynamic = 'force-dynamic'

/**
 * Review-request SMS sweep.
 *
 * The Vercel Hobby plan allows 2 crons at once-per-day frequency. This job uses
 * the second slot at 21:00 UTC, while the dispatcher at /api/cron/invoice-daily
 * also runs it at 09:00 UTC — giving two sweeps a day (max ~12h latency instead
 * of 24h). Double-running is safe: review_request_sent_at is claimed atomically
 * before each send, so a customer can never be texted twice.
 *
 * The real logic lives in lib/sms-cron-jobs.ts.
 *
 * Auth: CRON_SECRET via `x-cron-secret` or `Authorization: Bearer <secret>`.
 */
export async function GET(req: Request) {
  const secret =
    req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runReviewRequests()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 500 })
  }
}
