import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  runGenerateDrafts,
  runAutoSend,
  runProcessReminders,
  runMarkOverdue,
} from '@/lib/invoice-cron-jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * SINGLE scheduled cron — runs once per day.
 *
 * Dispatches to every scheduled job based on the UTC calendar:
 *   - Every day:            expire-requests, process-reminders, mark-overdue
 *   - 28th of each month:   + generate-drafts
 *   - 1st of each month:    + auto-send
 *
 * This is the ONLY cron in vercel.json so we stay within the Vercel Hobby plan
 * limit (2 crons, once-per-day frequency). The individual /api/cron/<job>
 * endpoints remain available for manual testing/triggering.
 *
 * Note: dispatch_requests also expire lazily whenever the approval queue is
 * read (same RPC), so this daily sweep is just a backstop for idle days.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const now = new Date()
  const dayOfMonth = now.getUTCDate()

  const summary: Record<string, unknown> = {
    ranAt: now.toISOString(),
    dayOfMonth,
    jobs: {} as Record<string, unknown>,
  }
  const jobs = summary.jobs as Record<string, unknown>

  // Expire any overdue pending dispatch_requests (approval-queue feasibility
  // window). Read paths also do this lazily; this is the idle-day backstop.
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('expire_dispatch_requests')
    if (error) throw error
    jobs.expireRequests = { ok: true, expired: (data as number) ?? 0 }
  } catch (e) {
    jobs.expireRequests = { ok: false, error: (e as Error).message }
  }

  // Run reminders next so today's due events go out before we flip anything to
  // overdue below.
  try {
    jobs.processReminders = await runProcessReminders()
  } catch (e) {
    jobs.processReminders = { ok: false, error: (e as Error).message }
  }

  try {
    jobs.markOverdue = await runMarkOverdue()
  } catch (e) {
    jobs.markOverdue = { ok: false, error: (e as Error).message }
  }

  if (dayOfMonth === 28) {
    try {
      jobs.generateDrafts = await runGenerateDrafts()
    } catch (e) {
      jobs.generateDrafts = { ok: false, error: (e as Error).message }
    }
  }

  if (dayOfMonth === 1) {
    try {
      jobs.autoSend = await runAutoSend()
    } catch (e) {
      jobs.autoSend = { ok: false, error: (e as Error).message }
    }
  }

  return NextResponse.json(summary)
}
