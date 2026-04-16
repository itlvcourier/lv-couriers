import type { NextRequest } from 'next/server'

/**
 * Verifies a request came from Vercel Cron (or an admin invoking with the shared secret).
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET env var is set. If CRON_SECRET is not configured we refuse all calls
 * in production but allow calls during local dev (NODE_ENV !== 'production').
 */
export function verifyCron(req: NextRequest): { ok: true } | { ok: false; status: number; reason: string } {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 500, reason: 'CRON_SECRET not configured' }
    }
    return { ok: true }
  }

  if (!header || header !== `Bearer ${secret}`) {
    return { ok: false, status: 401, reason: 'Unauthorized' }
  }
  return { ok: true }
}
