import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
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
 * Dispatches to the four invoice jobs based on the UTC calendar:
 *   - Every day:            process-reminders, mark-overdue
 *   - 28th of each month:   + generate-drafts
 *   - 1st of each month:    + auto-send
 *
 * This keeps us inside the Vercel Hobby plan limit of 2 crons (daily) while
 * still covering the full monthly billing lifecycle. The individual
 * /api/cron/<job> endpoints remain available for manual testing.
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

  // Always run reminders first so today's due events go out before we flip
  // anything to overdue below.
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
