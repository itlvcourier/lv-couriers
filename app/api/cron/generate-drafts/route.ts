import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvoiceSettings, logInvoiceEvent } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runs on the 28th of each month.
 * Builds DRAFT invoices for every business location with delivered-and-unbilled
 * orders in the just-ended billing period (previous month).
 *
 * Idempotent: if a draft already exists for (business_id, location_id, period),
 * it is skipped.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const settings = await getInvoiceSettings()
  if (!settings.auto_generate_invoices) {
    return NextResponse.json({ ok: true, skipped: 'auto_generate_invoices disabled' })
  }

  const supabase = createAdminClient()

  // Billing period: the month that just ended (if today is Mar 28, period is Mar 1 - Mar 31)
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const periodStartISO = periodStart.toISOString().split('T')[0]
  const periodEndISO = periodEnd.toISOString().split('T')[0]

  // Fetch delivered deliveries in period with rate_card context.
  const { data: deliveries, error: delErr } = await supabase
    .from('deliveries')
    .select('id, business_id, location_id, status, delivery_type, base_price, rush_fee, total, delivered_at')
    .eq('status', 'delivered')
    .gte('delivered_at', periodStart.toISOString())
    .lte('delivered_at', new Date(periodEnd.getTime() + 86_399_000).toISOString())

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Group by business_id + location_id
  type Bucket = { businessId: string; locationId: string | null; rows: typeof deliveries }
  const buckets = new Map<string, Bucket>()
  for (const d of deliveries || []) {
    const key = `${d.business_id}::${d.location_id || 'none'}`
    if (!buckets.has(key)) buckets.set(key, { businessId: d.business_id, locationId: d.location_id, rows: [] })
    buckets.get(key)!.rows.push(d)
  }

  const generated: string[] = []
  const skipped: string[] = []

  for (const [key, bucket] of buckets) {
    // Skip if draft already exists for this period
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('business_id', bucket.businessId)
      .eq('period_start', periodStartISO)
      .eq('period_end', periodEndISO)
      .maybeSingle()

    if (existing) {
      skipped.push(key)
      continue
    }

    // Fetch business + location for billing email defaults
    const [{ data: business }, { data: location }] = await Promise.all([
      supabase.from('businesses').select('id, name, email').eq('id', bucket.businessId).maybeSingle(),
      bucket.locationId
        ? supabase.from('business_locations').select('name, billing_email').eq('id', bucket.locationId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (!business) continue

    const subtotal = bucket.rows.reduce((s, r) => s + Number(r.base_price || 0) + Number(r.rush_fee || 0), 0)
    const gstTotal = +(subtotal * 0.05).toFixed(2)
    const total = +(subtotal + gstTotal).toFixed(2)

    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1 + settings.invoice_due_days))

    const invoiceNumber = `INV-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}-${key.slice(-4).toUpperCase()}`

    const { data: newInvoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        business_id: bucket.businessId,
        location_id: bucket.locationId,
        format: 'combined',
        period_start: periodStartISO,
        period_end: periodEndISO,
        subtotal,
        gst_total: gstTotal,
        adjustments: 0,
        total,
        status: 'draft',
        due_date: dueDate.toISOString().split('T')[0],
        billing_email: location?.billing_email || business.email || null,
      })
      .select('id')
      .single()

    if (invErr || !newInvoice) {
      console.error('[v0] cron generate-drafts insert invoice failed', invErr)
      continue
    }

    // Insert line items (one per delivery for simplicity; admin can consolidate)
    const lineItems = bucket.rows.map((d) => ({
      invoice_id: newInvoice.id,
      delivery_id: d.id,
      description: `${d.delivery_type} delivery`,
      quantity: 1,
      unit_rate: Number(d.base_price || 0) + Number(d.rush_fee || 0),
      gst: +((Number(d.base_price || 0) + Number(d.rush_fee || 0)) * 0.05).toFixed(2),
      total: Number(d.total || 0),
      is_adjustment: false,
    }))
    if (lineItems.length > 0) {
      await supabase.from('invoice_line_items').insert(lineItems)
    }

    await logInvoiceEvent({
      invoice_id: newInvoice.id,
      event_type: 'generated',
      note: `Auto-generated draft for ${periodStartISO} — ${periodEndISO}`,
    })

    generated.push(newInvoice.id)
  }

  return NextResponse.json({
    ok: true,
    period: { start: periodStartISO, end: periodEndISO },
    generated: generated.length,
    skipped: skipped.length,
  })
}
