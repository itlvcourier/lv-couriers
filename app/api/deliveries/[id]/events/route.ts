import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { dispatchDeliveryEvent } from '@/lib/webhooks'

/**
 * Called by the app after a status change. The server re-reads the delivery's
 * current status, so callers cannot forge event contents.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth
  const result = await dispatchDeliveryEvent(id).catch(() => ({ sent: 0 }))
  return NextResponse.json(result)
}
