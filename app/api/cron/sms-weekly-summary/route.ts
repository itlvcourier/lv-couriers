import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Cron: send weekly delivery summary SMS to all active businesses.
 * Schedule: Sundays at 8am (configure in vercel.json cron)
 * Covers: deliveries completed in the past 7 days per business
 * Setting gate: sms_notify_weekly_summary (default OFF)
 * Auth: CRON_SECRET header required
 */
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check setting gate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_weekly_summary')
    .limit(1)
    .maybeSingle()
  if (!settings?.sms_notify_weekly_summary) {
    return NextResponse.json({ ok: false, reason: 'Weekly summary feature is disabled' })
  }

  // Get deliveries from the past 7 days
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceISO = since.toISOString()

  const { data: deliveries, error: dErr } = await supabase
    .from('deliveries')
    .select('id, business_id, status, delivered_at')
    .gte('delivered_at', sinceISO)
    .eq('status', 'delivered')

  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 })
  }

  // Group by business_id
  const byBusiness = new Map<string, number>()
  for (const d of (deliveries ?? [])) {
    const count = byBusiness.get(d.business_id as string) ?? 0
    byBusiness.set(d.business_id as string, count + 1)
  }

  if (byBusiness.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'No deliveries in the past week' })
  }

  // Fetch business names and phones
  const businessIds = Array.from(byBusiness.keys())
  const { data: businesses, error: bErr } = await supabase
    .from('businesses')
    .select('id, name, phone')
    .in('id', businessIds)

  if (bErr) {
    return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  const weekLabel = `${since.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`

  const sends: Array<Promise<{ ok: boolean; businessId: string }>> = []
  for (const biz of (businesses ?? []) as Array<{ id: string; name: string; phone: string | null }>) {
    if (!biz.phone) continue
    const count = byBusiness.get(biz.id) ?? 0
    sends.push(
      sendSms({
        to: biz.phone,
        body:
          `${biz.name} weekly summary (${weekLabel}): ` +
          `${count} delivery${count !== 1 ? 'ies' : 'y'} completed. ` +
          `Log in for details. — LV Couriers`,
        type: 'weekly_summary',
      }).then(r => ({ ok: r.ok, businessId: biz.id })),
    )
  }

  const results = await Promise.all(sends)
  const sent = results.filter(r => r.ok).length
  return NextResponse.json({ ok: true, sent, total: results.length })
}
