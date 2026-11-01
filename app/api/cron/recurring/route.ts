import { NextRequest, NextResponse } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { runRecurringSweep } from '@/lib/recurring-runner'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ok = verifyCron(req)
  if (!ok.ok) return NextResponse.json({ error: ok.reason }, { status: ok.status })
  return NextResponse.json(await runRecurringSweep())
}
