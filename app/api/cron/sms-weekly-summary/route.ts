import { NextResponse } from 'next/server'
import { runWeeklySmsSummary } from '@/lib/sms-cron-jobs'

export const dynamic = 'force-dynamic'

/**
 * Manual/testing endpoint for the weekly business summary SMS.
 *
 * NOT scheduled in vercel.json — the Vercel Hobby plan allows only 2 crons at
 * once-per-day frequency, so this job runs each Monday from the single daily
 * dispatcher at /api/cron/invoice-daily. Logic lives in lib/sms-cron-jobs.ts.
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
    const result = await runWeeklySmsSummary()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 500 })
  }
}
