import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { runAutoSend } from '@/lib/invoice-cron-jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Manual/test endpoint. The real schedule runs via /api/cron/invoice-daily
 * which dispatches to this job only on the 1st of each month.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  try {
    const result = await runAutoSend()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
