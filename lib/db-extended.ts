/**
 * Supabase helpers used by context.tsx for hydration + mutation persistence.
 * Maps DB snake_case rows to the app's camelCase types in lib/types.ts.
 */
import { createClient } from '@/lib/supabase/client'
import type {
  Delivery,
  Driver,
  Business,
  BusinessLocation,
  RateCard,
  Invoice,
  InvoiceLine,
  ManifestItem,
  SystemSettings,
  DeliveryStatus,
  DeliveryFlag,
  FailReason,
  InvoiceEmailEvent,
  InvoiceStatus,
  PickupVerification,
} from './types'

type Row = Record<string, unknown>

// ============================================================================
// Mappers
// ============================================================================

export function mapBusinessRow(row: Row): Business {
  return {
    id: row.id as string,
    name: row.name as string,
    invoiceFormat: (row.invoice_format as Business['invoiceFormat']) || 'combined',
    inviteStatus: (row.status === 'suspended'
      ? 'deactivated'
      : row.status === 'pending'
        ? 'pending'
        : 'active'),
    locations: Array.isArray(row.locations)
      ? (row.locations as Row[]).map(l => mapLocationRow(l))
      : [],
  }
}

export function mapLocationRow(row: Row): BusinessLocation {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    name: row.name as string,
    address: (row.address as string) || '',
    billingEmail: (row.billing_email as string) || '',
    backupEmail: (row.backup_email as string) || '',
    contactName: (row.contact_name as string) || '',
    phone: (row.contact_phone as string) || '',
    savedAddresses: [],
  }
}

export function mapDriverRow(row: Row): Driver {
  const avg = row.avg_delivery_mins as number | null
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string) || '',
    status: (row.status as Driver['status']) || 'available',
    maxJobsOverride: (row.max_jobs_override as number | null) ?? null,
    totalDeliveries: (row.total_deliveries as number) ?? 0,
    todayDeliveries: (row.today_deliveries as number) ?? 0,
    monthDeliveries: (row.month_deliveries as number) ?? 0,
    averageTime: avg != null ? `${avg}m` : '',
    rushSlaRate: (row.rush_sla_rate as number) ?? 0,
    monthlyAdjustments: 0,
    inviteStatus: (row.invite_status as Driver['inviteStatus']) || 'active',
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  }
}

export function mapRateCardRow(row: Row): RateCard {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    locationId: row.location_id as string,
    effectiveDate: (row.effective_date as string) || new Date().toISOString().split('T')[0],
    rateRegular: Number(row.rate_regular) || 0,
    rateBigDouble: Number(row.rate_big_double) || 0,
    rateOotBig: row.rate_oot_big != null ? Number(row.rate_oot_big) : null,
    rateRush: Number(row.rate_rush) || 0,
    rateRushOot: Number(row.rate_rush_oot) || 0,
    gstApplicable: !!row.gst_applicable,
    cancelBeforeDepart: row.cancel_before_depart != null ? Number(row.cancel_before_depart) : 0,
    cancelEnRoute: row.cancel_en_route != null ? Number(row.cancel_en_route) : 5,
    notifyDriverAssigned: !!row.notify_driver_assigned,
    notifyPickupConfirmed: !!row.notify_pickup_confirmed,
    notifyEnRoute: !!row.notify_en_route,
    notifyDelivered: !!row.notify_delivered,
    notifyFailed: !!row.notify_failed,
    notifyInvoiceSent: !!row.notify_invoice_sent,
    notifyPaymentReminder: !!row.notify_payment_reminder,
    notifyRecipientSms: !!row.notify_recipient_sms,
    billingEmail: (row.billing_email as string) || '',
    backupEmail: (row.backup_email as string) || '',
    contractNotes: (row.contract_notes as string) || '',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  }
}

export function mapManifestRow(row: Row): ManifestItem {
  return {
    id: row.id as string,
    type: (row.item_type as ManifestItem['type']) || 'small_package',
    postedQty: Number(row.quantity) || 0,
    confirmedQty: row.confirmed_qty != null ? Number(row.confirmed_qty) : null,
    verificationPhotoUrl: (row.verification_photo_url as string | null) ?? null,
    notes: (row.notes as string) || '',
  }
}

export function mapDeliveryRow(row: Row): Delivery {
  const business = (row as { business?: { name?: string } }).business
  const driver = (row as { driver?: { name?: string } }).driver
  const durationMins = (row.duration_mins as number | null) ?? null

  return {
    id: row.id as string,
    businessId: row.business_id as string,
    businessName: business?.name || '',
    locationId: row.location_id as string,
    driverId: (row.driver_id as string | null) ?? null,
    driverName: driver?.name || null,
    status: row.status as DeliveryStatus,
    pickupAddress: (row.pickup_address as string) || '',
    pickupArea: (row.pickup_area as string) || '',
    pickupLat: (row.pickup_lat as number | null) ?? null,
    pickupLng: (row.pickup_lng as number | null) ?? null,
    dropoffAddress: (row.dropoff_address as string) || '',
    dropoffArea: (row.dropoff_area as string) || '',
    dropoffLat: (row.dropoff_lat as number | null) ?? null,
    dropoffLng: (row.dropoff_lng as number | null) ?? null,
    recipientName: (row.recipient_name as string | null) ?? null,
    recipientPhone: (row.recipient_phone as string | null) ?? null,
    buzzCode: (row.buzz_code as string | null) ?? null,
    manifest: Array.isArray((row as { manifest_items?: Row[] }).manifest_items)
      ? (row as { manifest_items: Row[] }).manifest_items.map(mapManifestRow)
      : [],
    isUrgent: !!row.is_urgent,
    isOutOfTown: !!row.is_out_of_town,
    isRush: !!row.is_rush,
    retryCount: (row.retry_count as number) ?? 0,
    postedAt: (row.posted_at as string) || (row.created_at as string) || new Date().toISOString(),
    claimedAt: (row.claimed_at as string | null) ?? null,
    pickupArrivedAt: (row.pickup_arrived_at as string | null) ?? null,
    pickedUpAt: (row.picked_up_at as string | null) ?? null,
    deliveredAt: (row.delivered_at as string | null) ?? null,
    rateCardId: (row.rate_card_id as string | null) ?? null,
    calculatedRate: (row.calculated_rate as number | null) ?? null,
    gstAmount: (row.gst_amount as number | null) ?? null,
    totalAmount: (row.total_amount as number | null) ?? null,
    invoiceId: (row.invoice_id as string | null) ?? null,
    durationMins,
    duration: durationMins != null ? `${durationMins}m` : null,
    proofPhotoUrl: (row.proof_photo_url as string | null) ?? null,
    recipientNote: (row.recipient_note as string | null) ?? null,
    trackingCode: (row.tracking_code as string | null) ?? null,
    trackingExpiresAt: (row.tracking_expires_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancellationStage: (row.cancellation_stage as Delivery['cancellationStage']) ?? null,
    cancellationFee: (row.cancellation_fee as number | null) ?? null,
    cancellationReason: (row.cancellation_reason as string | null) ?? null,
    tripId: (row.trip_id as string | null) ?? null,
    tripOrder: (row.trip_order as number | null) ?? null,
    flags: [],
    verifications: [],
    statusHistory: [],
    createdAt: (row.created_at as string) || undefined,
    updatedAt: (row.updated_at as string) || undefined,
  }
}

export function mapSettingsRow(row: Row): SystemSettings {
  return {
    globalMaxJobs: (row.default_max_jobs_per_driver as number) ?? 3,
    rushSlaMins: (row.rush_sla_mins as number) ?? 45,
    intownTimeoutMins: (row.intown_timeout_mins as number) ?? 90,
    outOfTownTimeoutMins: (row.out_of_town_timeout_mins as number) ?? 150,
    autoGenerateInvoices: row.auto_generate_invoices !== false,
    invoiceDueDays: (row.invoice_due_days as number) ?? 15,
    autoSendInvoices: !!row.auto_send_invoices,
    reminderDay1: (row.invoice_reminder_day_1 as number) ?? 7,
    overdueDay: (row.invoice_overdue_notice_day as number) ?? 7,
    escalationDay: (row.invoice_escalation_day as number) ?? 14,
    reviewReminderDays: (row.invoice_review_reminder_days as number) ?? 2,
    sendReminderEmail: row.send_reminder_email !== false,
    sendReminderSms: !!row.send_reminder_sms,
    cancellationBeforeDepart: (row.cancel_fee_before_depart as number) ?? 0,
    cancellationEnRoute: (row.cancel_fee_en_route as number) ?? 5,
  }
}

export function mapInvoiceRow(row: Row): Invoice {
  const lineItems = Array.isArray((row as { invoice_line_items?: Row[] }).invoice_line_items)
    ? (row as { invoice_line_items: Row[] }).invoice_line_items
    : []
  const events = Array.isArray((row as { invoice_events?: Row[] }).invoice_events)
    ? (row as { invoice_events: Row[] }).invoice_events
    : []

  return {
    id: row.id as string,
    invoiceNumber: (row.invoice_number as string) || '',
    businessId: row.business_id as string,
    businessName: '',
    locationId: (row.location_id as string) || '',
    locationName: '',
    locationAddress: '',
    billingEmail: (row.billing_email as string) || '',
    periodStart: (row.period_start as string) || '',
    periodEnd: (row.period_end as string) || '',
    subtotal: Number(row.subtotal) || 0,
    gstAmount: Number(row.gst_amount) || 0,
    total: Number(row.total_amount) || 0,
    status: (row.status as InvoiceStatus) || 'draft',
    dueDate: (row.due_date as string) || '',
    paidDate: (row.paid_at as string | null) ?? null,
    paymentMethod: (row.payment_method as string | null) ?? null,
    paymentReference: (row.payment_reference as string | null) ?? null,
    amountReceived: (row.amount_received as number | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    openedAt: (row.opened_at as string | null) ?? null,
    remindersPaused: !!row.reminders_paused,
    remindersSkipCount: (row.reminders_skip_count as number) ?? 0,
    emailBounced: !!row.email_bounced,
    backupBillingEmail: (row.backup_billing_email as string | null) ?? null,
    recipientPhone: (row.recipient_phone as string | null) ?? null,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
    emailLog: events.map(e => ({
      id: e.id as string,
      type: e.event_type as InvoiceEmailEvent['type'],
      timestamp: (e.occurred_at as string) || (e.scheduled_for as string) || (e.created_at as string),
      email: (e.email as string) || undefined,
      note: (e.note as string) || undefined,
      isScheduled: e.occurred_at == null && e.scheduled_for != null,
    })),
    lines: lineItems.map((li): InvoiceLine => ({
      id: li.id as string,
      description: (li.description as string) || '',
      deliveryType: li.delivery_type as InvoiceLine['deliveryType'],
      quantity: Number(li.count) || 0,
      rate: Number(li.rate) || 0,
      total: Number(li.subtotal) || 0,
      deliveryIds: Array.isArray(li.delivery_ids) ? (li.delivery_ids as string[]) : [],
    })),
  }
}

// ============================================================================
// Loaders
// ============================================================================

export async function loadAllBusinesses(): Promise<Business[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select('*, locations:business_locations(*)')
    .order('name')
  if (error) throw error
  return (data || []).map(mapBusinessRow)
}

export async function loadAllDrivers(): Promise<Driver[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('drivers').select('*').order('name')
  if (error) throw error
  return (data || []).map(mapDriverRow)
}

export async function loadAllRateCards(): Promise<RateCard[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('rate_cards').select('*')
  if (error) throw error
  return (data || []).map(mapRateCardRow)
}

export async function loadSettings(): Promise<SystemSettings> {
  const supabase = createClient()
  const { data } = await supabase.from('system_settings').select('*').limit(1).maybeSingle()
  if (!data) return mapSettingsRow({})
  return mapSettingsRow(data as Row)
}

export async function loadDeliveries(profile: {
  role: string
  businessId: string | null
  driverId: string | null
}): Promise<Delivery[]> {
  const supabase = createClient()
  let query = supabase
    .from('deliveries')
    .select('*, business:businesses(name), driver:drivers(name), manifest_items(*)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (profile.role === 'business' && profile.businessId) {
    query = query.eq('business_id', profile.businessId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(row => mapDeliveryRow(row as Row))
}

export async function loadInvoices(profile: {
  role: string
  businessId: string | null
}): Promise<Invoice[]> {
  const supabase = createClient()
  let query = supabase
    .from('invoices')
    .select('*, invoice_line_items(*), invoice_events(*)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (profile.role === 'business' && profile.businessId) {
    query = query.eq('business_id', profile.businessId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(row => mapInvoiceRow(row as Row))
}

// ============================================================================
// Mutations
// ============================================================================

export async function createDeliveryInDb(input: {
  businessId: string
  locationId: string
  pickupAddress: string
  pickupArea: string
  dropoffAddress: string
  dropoffArea: string
  recipientName?: string | null
  recipientPhone?: string | null
  recipientNote?: string | null
  buzzCode?: string | null
  isRush: boolean
  isOutOfTown: boolean
  isUrgent?: boolean
  manifest: Array<{ type: ManifestItem['type']; quantity: number; notes?: string }>
}): Promise<Delivery> {
  const supabase = createClient()
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .insert({
      business_id: input.businessId,
      location_id: input.locationId,
      status: 'posted',
      pickup_address: input.pickupAddress,
      pickup_area: input.pickupArea,
      dropoff_address: input.dropoffAddress,
      dropoff_area: input.dropoffArea,
      recipient_name: input.recipientName ?? null,
      recipient_phone: input.recipientPhone ?? null,
      recipient_note: input.recipientNote ?? null,
      buzz_code: input.buzzCode ?? null,
      is_rush: input.isRush,
      is_urgent: input.isUrgent ?? input.isRush,
      is_out_of_town: input.isOutOfTown,
      posted_at: new Date().toISOString(),
      retry_count: 0,
    })
    .select()
    .single()
  if (error) throw error

  const newId = (delivery as Row).id as string
  if (input.manifest.length > 0) {
    const { error: mErr } = await supabase.from('manifest_items').insert(
      input.manifest.map(m => ({
        delivery_id: newId,
        item_type: m.type,
        quantity: m.quantity,
        notes: m.notes || null,
      })),
    )
    if (mErr) throw mErr
  }

  const { data: full } = await supabase
    .from('deliveries')
    .select('*, business:businesses(name), driver:drivers(name), manifest_items(*)')
    .eq('id', newId)
    .single()
  return mapDeliveryRow((full || delivery) as Row)
}

export async function updateDeliveryFields(
  deliveryId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('deliveries').update(fields).eq('id', deliveryId)
  if (error) throw error
}

export async function saveRateCardToDb(rateCard: RateCard): Promise<RateCard> {
  const supabase = createClient()
  const payload = {
    id: rateCard.id,
    business_id: rateCard.businessId,
    location_id: rateCard.locationId,
    effective_date: rateCard.effectiveDate,
    rate_regular: rateCard.rateRegular,
    rate_big_double: rateCard.rateBigDouble,
    rate_oot_big: rateCard.rateOotBig,
    rate_rush: rateCard.rateRush,
    rate_rush_oot: rateCard.rateRushOot,
    gst_applicable: rateCard.gstApplicable,
    cancel_before_depart: rateCard.cancelBeforeDepart,
    cancel_en_route: rateCard.cancelEnRoute,
    notify_driver_assigned: rateCard.notifyDriverAssigned,
    notify_pickup_confirmed: rateCard.notifyPickupConfirmed,
    notify_en_route: rateCard.notifyEnRoute,
    notify_delivered: rateCard.notifyDelivered,
    notify_failed: rateCard.notifyFailed,
    notify_invoice_sent: rateCard.notifyInvoiceSent,
    notify_payment_reminder: rateCard.notifyPaymentReminder,
    notify_recipient_sms: rateCard.notifyRecipientSms,
    billing_email: rateCard.billingEmail,
    backup_email: rateCard.backupEmail,
    contract_notes: rateCard.contractNotes,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('rate_cards')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return mapRateCardRow(data as Row)
}

export async function saveSettingsToDb(partial: Partial<SystemSettings>): Promise<void> {
  const supabase = createClient()
  const p: Record<string, unknown> = {}
  if (partial.globalMaxJobs != null) p.default_max_jobs_per_driver = partial.globalMaxJobs
  if (partial.rushSlaMins != null) p.rush_sla_mins = partial.rushSlaMins
  if (partial.intownTimeoutMins != null) p.intown_timeout_mins = partial.intownTimeoutMins
  if (partial.outOfTownTimeoutMins != null) p.out_of_town_timeout_mins = partial.outOfTownTimeoutMins
  if (partial.autoGenerateInvoices != null) p.auto_generate_invoices = partial.autoGenerateInvoices
  if (partial.invoiceDueDays != null) p.invoice_due_days = partial.invoiceDueDays
  if (partial.autoSendInvoices != null) p.auto_send_invoices = partial.autoSendInvoices
  if (partial.reminderDay1 != null) p.invoice_reminder_day_1 = partial.reminderDay1
  if (partial.overdueDay != null) p.invoice_overdue_notice_day = partial.overdueDay
  if (partial.escalationDay != null) p.invoice_escalation_day = partial.escalationDay
  if (partial.reviewReminderDays != null) p.invoice_review_reminder_days = partial.reviewReminderDays
  if (partial.sendReminderEmail != null) p.send_reminder_email = partial.sendReminderEmail
  if (partial.sendReminderSms != null) p.send_reminder_sms = partial.sendReminderSms
  if (partial.cancellationBeforeDepart != null) p.cancel_fee_before_depart = partial.cancellationBeforeDepart
  if (partial.cancellationEnRoute != null) p.cancel_fee_en_route = partial.cancellationEnRoute

  const { data: rows } = await supabase.from('system_settings').select('id').limit(1)
  if (rows && rows.length > 0) {
    const { error } = await supabase.from('system_settings').update(p).eq('id', (rows[0] as Row).id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('system_settings').insert(p)
    if (error) throw error
  }
}

export async function saveBusinessToDb(business: Business): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('businesses').upsert({
    id: business.id,
    name: business.name,
    invoice_format: business.invoiceFormat,
    status: business.inviteStatus === 'deactivated'
      ? 'suspended'
      : business.inviteStatus === 'pending'
        ? 'pending'
        : 'active',
  })
  if (error) throw error

  for (const loc of business.locations) {
    const { error: le } = await supabase.from('business_locations').upsert({
      id: loc.id,
      business_id: business.id,
      name: loc.name,
      address: loc.address,
      billing_email: loc.billingEmail,
      backup_email: loc.backupEmail,
      contact_name: loc.contactName,
      contact_phone: loc.phone,
    })
    if (le) throw le
  }
}

export async function saveLocationToDb(businessId: string, loc: BusinessLocation): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('business_locations').upsert({
    id: loc.id,
    business_id: businessId,
    name: loc.name,
    address: loc.address,
    billing_email: loc.billingEmail,
    backup_email: loc.backupEmail,
    contact_name: loc.contactName,
    contact_phone: loc.phone,
  })
  if (error) throw error
}

export async function updateDriverRow(driverId: string, fields: Record<string, unknown>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('drivers').update(fields).eq('id', driverId)
  if (error) throw error
}

export async function createDriverInDb(driver: Omit<Driver, 'id'>): Promise<Driver> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .insert({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      status: driver.status,
      max_jobs_override: driver.maxJobsOverride,
      total_deliveries: driver.totalDeliveries || 0,
      today_deliveries: driver.todayDeliveries || 0,
      month_deliveries: driver.monthDeliveries || 0,
      invite_status: driver.inviteStatus || 'active',
    })
    .select()
    .single()
  if (error) throw error
  return mapDriverRow(data as Row)
}

export async function applyPickupVerifications(
  deliveryId: string,
  verifications: PickupVerification[],
  calculatedRate: number,
  gstAmount: number,
  totalAmount: number,
  rateCardId: string | null,
): Promise<void> {
  const supabase = createClient()
  for (const v of verifications) {
    const { error } = await supabase
      .from('manifest_items')
      .update({
        confirmed_qty: v.confirmedQty,
        verification_photo_url: v.photoUrl,
      })
      .eq('id', v.itemId)
    if (error) throw error
  }
  const { error: dErr } = await supabase
    .from('deliveries')
    .update({
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
      calculated_rate: calculatedRate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      rate_card_id: rateCardId,
    })
    .eq('id', deliveryId)
  if (dErr) throw dErr
}

export async function insertDeliveryFlag(flag: {
  deliveryId: string
  type: DeliveryFlag['type']
  description: string
  photoUrl: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error: fErr } = await supabase.from('delivery_flags').insert({
    delivery_id: flag.deliveryId,
    flag_type: flag.type,
    description: flag.description,
    photo_url: flag.photoUrl,
    status: 'open',
  })
  if (fErr) throw fErr
  const { error: dErr } = await supabase
    .from('deliveries')
    .update({ status: 'flagged' })
    .eq('id', flag.deliveryId)
  if (dErr) throw dErr
}

export async function insertFailureAndFinalize(
  deliveryId: string,
  reason: FailReason,
  notes: string | undefined,
  permanent: boolean,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('deliveries')
    .update({
      status: permanent ? 'failed_permanent' : 'failed_retry',
      cancellation_reason: notes ? `${reason}: ${notes}` : reason,
    })
    .eq('id', deliveryId)
  if (error) throw error
}

export async function cancelDeliveryInDb(
  deliveryId: string,
  stage: 'before_depart' | 'en_route_pickup' | 'after_pickup',
  fee: number,
  reason: string | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('deliveries')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_stage: stage,
      cancellation_fee: fee,
      cancellation_reason: reason,
    })
    .eq('id', deliveryId)
  if (error) throw error
}
