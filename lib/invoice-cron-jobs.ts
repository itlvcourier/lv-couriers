import { createAdminClient } from '@/lib/supabase/admin'
import {
  getInvoiceSettings,
  logInvoiceEvent,
  scheduleInvoiceEvent,
  sendInvoiceAndRecord,
  type CronInvoiceRow,
} from '@/lib/invoice-db'
import { sendEmail } from '@/lib/email'
import { invoiceReviewReminderEmail } from '@/lib/email-templates'

/**
 * Pure job functions — no HTTP, no auth. Each returns a JSON-serializable
 * summary that a route handler can return as a NextResponse body.
 */

// 1. Generate draft invoices for the just-ended billing period
export async function runGenerateDrafts() {
  const settings = await getInvoiceSettings()
  if (!settings.auto_generate_invoices) {
    return { ok: true, skipped: 'auto_generate_invoices disabled' as const }
  }

  const supabase = createAdminClient()
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const periodStartISO = periodStart.toISOString().split('T')[0]
  const periodEndISO = periodEnd.toISOString().split('T')[0]

  const { data: deliveries, error: delErr } = await supabase
    .from('deliveries')
    .select('id, business_id, location_id, status, delivery_type, base_price, rush_fee, total, delivered_at')
    .eq('status', 'delivered')
    .gte('delivered_at', periodStart.toISOString())
    .lte('delivered_at', new Date(periodEnd.getTime() + 86_399_000).toISOString())

  if (delErr) throw new Error(delErr.message)

  type Bucket = { businessId: string; locationId: string | null; rows: NonNullable<typeof deliveries> }
  const buckets = new Map<string, Bucket>()
  for (const d of deliveries || []) {
    const key = `${d.business_id}::${d.location_id || 'none'}`
    if (!buckets.has(key)) buckets.set(key, { businessId: d.business_id, locationId: d.location_id, rows: [] })
    buckets.get(key)!.rows.push(d)
  }

  const generated: string[] = []
  const skipped: string[] = []

  for (const [key, bucket] of buckets) {
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

    const [{ data: business }, { data: location }] = await Promise.all([
      supabase.from('businesses').select('id, name, email').eq('id', bucket.businessId).maybeSingle(),
      bucket.locationId
        ? supabase.from('business_locations').select('name, billing_email').eq('id', bucket.locationId).maybeSingle()
        : Promise.resolve({ data: null as { name: string; billing_email: string | null } | null }),
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

  // If auto-send is OFF and we generated at least one draft, ping admins so
  // they know to review before the 1st-of-month auto-send window.
  let reviewEmailOk = false
  if (!settings.auto_send_invoices && generated.length > 0) {
    const adminRecipients = await resolveAdminEmails(supabase)
    if (adminRecipients.length > 0) {
      const site =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      const adminUrl = `${(site || '').replace(/\/$/, '')}/admin?tab=invoices`
      const tpl = invoiceReviewReminderEmail({
        draftCount: generated.length,
        periodLabel: `${periodStartISO} – ${periodEndISO}`,
        adminUrl,
      })
      const r = await sendEmail({
        to: adminRecipients,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tag: 'invoice.review_reminder',
      })
      reviewEmailOk = r.ok
    }
  }

  return {
    ok: true,
    period: { start: periodStartISO, end: periodEndISO },
    generated: generated.length,
    skipped: skipped.length,
    reviewEmailOk,
  }
}

async function resolveAdminEmails(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const env = process.env.ADMIN_NOTIFICATION_EMAIL?.trim()
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean)
  const { data } = await supabase.from('profiles').select('email').eq('role', 'admin')
  return (data || []).map(r => r.email).filter((e): e is string => !!e)
}

// 2. Send every draft invoice on the 1st (if auto-send is enabled)
export async function runAutoSend() {
  const settings = await getInvoiceSettings()
  if (!settings.auto_send_invoices) {
    return { ok: true, skipped: 'auto_send_invoices disabled' as const }
  }

  const supabase = createAdminClient()

  const { data: drafts, error } = await supabase
    .from('invoices')
    .select(
      `id, invoice_number, business_id, location_id, billing_email, backup_billing_email,
       status, due_date, sent_at, period_start, period_end, total, reminders_paused, email_bounced,
       businesses(name),
       business_locations(name)`,
    )
    .eq('status', 'draft')
    .returns<Array<CronInvoiceRow & { businesses: { name: string } | null; business_locations: { name: string } | null }>>()

  if (error) throw new Error(error.message)

  const results: Array<{ invoiceId: string; ok: boolean; reason?: string }> = []
  const now = new Date()

  for (const row of drafts || []) {
    if (!row.billing_email || row.email_bounced) {
      results.push({ invoiceId: row.id, ok: false, reason: 'missing or bounced email' })
      continue
    }

    const normalized: CronInvoiceRow = {
      ...row,
      business_name: row.businesses?.name || 'Business',
      location_name: row.business_locations?.name || null,
    }

    const { result } = await sendInvoiceAndRecord(normalized, 'sent')
    if (!result.ok) {
      results.push({ invoiceId: row.id, ok: false, reason: result.reason })
      continue
    }

    const due = new Date(row.due_date + 'T00:00:00Z')
    await supabase.from('invoices').update({ status: 'sent', sent_at: now.toISOString() }).eq('id', row.id)

    const r1 = new Date(now)
    r1.setUTCDate(r1.getUTCDate() + settings.invoice_reminder_day_1)
    const overdue = new Date(due)
    overdue.setUTCDate(overdue.getUTCDate() + settings.invoice_overdue_notice_day)
    const escalation = new Date(due)
    escalation.setUTCDate(escalation.getUTCDate() + settings.invoice_escalation_day)

    await Promise.all([
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'reminder_1', scheduled_for: r1 }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'reminder_2', scheduled_for: due }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'overdue_notice', scheduled_for: overdue }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'escalated', scheduled_for: escalation }),
    ])

    results.push({ invoiceId: row.id, ok: true })
  }

  return {
    ok: true,
    sent: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => !r.ok).length,
    results,
  }
}

// 3. Pick up every scheduled reminder whose time has come and fire it
export async function runProcessReminders() {
  const supabase = createAdminClient()
  const now = new Date()

  const { data: due, error } = await supabase
    .from('invoice_events')
    .select('id, invoice_id, event_type, scheduled_for')
    .is('occurred_at', null)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(500)

  if (error) throw new Error(error.message)

  let processed = 0
  let skipped = 0
  let failed = 0

  for (const ev of due || []) {
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select(
        `id, invoice_number, business_id, location_id, billing_email, backup_billing_email,
         status, due_date, sent_at, period_start, period_end, total, reminders_paused, email_bounced,
         businesses(name),
         business_locations(name)`,
      )
      .eq('id', ev.invoice_id)
      .maybeSingle<
        CronInvoiceRow & { businesses: { name: string } | null; business_locations: { name: string } | null }
      >()

    if (invErr || !inv) {
      failed++
      continue
    }

    const terminal = ['paid', 'disputed', 'escalated']
    if (terminal.includes(inv.status) || inv.reminders_paused || inv.email_bounced) {
      await supabase
        .from('invoice_events')
        .update({
          occurred_at: now.toISOString(),
          scheduled_for: null,
          note: `Skipped: status=${inv.status}${inv.reminders_paused ? ' paused' : ''}${inv.email_bounced ? ' bounced' : ''}`,
        })
        .eq('id', ev.id)
      skipped++
      continue
    }

    const normalized: CronInvoiceRow = {
      ...inv,
      business_name: inv.businesses?.name || 'Business',
      location_name: inv.business_locations?.name || null,
    }

    const kind = ev.event_type as 'reminder_1' | 'reminder_2' | 'overdue_notice' | 'escalated'

    if (kind === 'escalated') {
      await supabase.from('invoices').update({ status: 'escalated' }).eq('id', inv.id)
    }

    const { result } = await sendInvoiceAndRecord(normalized, kind)

    await supabase
      .from('invoice_events')
      .update({
        occurred_at: now.toISOString(),
        scheduled_for: null,
        note: result.ok ? null : `Send failed: ${result.reason}`,
      })
      .eq('id', ev.id)

    if (result.ok) processed++
    else failed++
  }

  return { ok: true, processed, skipped, failed, total: (due || []).length }
}

// 4. Flip any SENT invoices with a passed due_date to OVERDUE
export async function runMarkOverdue() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'sent')
    .lt('due_date', today)
    .select('id, invoice_number, due_date')

  if (error) throw new Error(error.message)

  for (const row of data || []) {
    await logInvoiceEvent({
      invoice_id: row.id,
      event_type: 'overdue_notice',
      note: `Auto-marked overdue (was sent, due ${row.due_date})`,
    })
  }

  return {
    ok: true,
    flipped: (data || []).length,
    invoiceIds: (data || []).map((r) => r.id),
  }
}
