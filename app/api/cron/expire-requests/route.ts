import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * §3 Approval-queue expiry sweep. Flips overdue pending dispatch_requests to
 * `expired` so a late-order/address-change can't be approved after its
 * operational feasibility window has passed.
 *
 * Runs on a schedule (see vercel.json) so requests expire on time even when no
 * admin happens to open the queue. The list/count read paths still call the
 * same RPC as a belt-and-suspenders fallback.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('expire_dispatch_requests')
    if (error) throw error
    return NextResponse.json({ ok: true, expired: (data as number) ?? 0 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
