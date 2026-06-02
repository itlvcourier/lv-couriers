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
  SavedContact,
  AdminNotification,
  AdminNotificationType,
  SMSLogEntry,
  SMSType,
  SMSStatus,
  Dispute,
  DisputeStatus,
  CustomerFeedback,
  DriverRatingsSummary,
  BusinessRatingsSummary,
  RadiusPricingTier,
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
    inviteStatus: (row.invite_status as Business['inviteStatus']) || 'active',
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
    phone: (row.phone as string) || '',
    savedAddresses: [],
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
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

export function mapRadiusTierRow(row: Row): RadiusPricingTier {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    maxDistanceKm: Number(row.max_distance_km) || 0,
    rateRegular: Number(row.rate_regular) || 0,
    rateRush: Number(row.rate_rush) || 0,
    rateBigParcel: Number(row.rate_big_parcel) || 0,
    rateRushBig: Number(row.rate_rush_big) || 0,
    label: (row.label as string | null) ?? null,
    sortOrder: Number(row.sort_order) || 0,
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
    // Note: billingEmail and backupEmail are on business_locations, not rate_cards
    // They should be fetched from the location data instead
    contractNotes: (row.contract_notes as string) || '',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
    useRadiusPricing: !!row.use_radius_pricing,
    radiusTiers: undefined, // Loaded separately when needed
  }
}

export function mapManifestRow(row: Row): ManifestItem {
  // DB only stores quantity (initially the posted count, overwritten to
  // the confirmed count at pickup verification). We expose both on the
  // client type but they point at the same DB column for now.
  const qty = Number(row.quantity) || 0
  return {
    id: row.id as string,
    type: (row.item_type as ManifestItem['type']) || 'small_package',
    postedQty: qty,
    confirmedQty: qty,
    verificationPhotoUrl: null,
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
    pickupPostalCode: (row.pickup_postal_code as string | null) ?? null,
    pickupLat: (row.pickup_lat as number | null) ?? null,
    pickupLng: (row.pickup_lng as number | null) ?? null,
    dropoffAddress: (row.dropoff_address as string) || '',
    dropoffArea: (row.dropoff_area as string) || '',
    dropoffPostalCode: (row.dropoff_postal_code as string | null) ?? null,
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
    pickupPhotoUrl: (row.pickup_photo_url as string | null) ?? null,
    proofPhotoUrl: (row.proof_photo_url as string | null) ?? null,
    signatureUrl: (row.signature_url as string | null) ?? null,
    recipientNote: (row.recipient_note as string | null) ?? null,
    requireSignature: !!(row.require_signature as boolean | null),
    requirePhoto: (row.require_photo as boolean | null) ?? true,
    trackingCode: (row.tracking_code as string | null) ?? null,
    trackingExpiresAt: (row.tracking_expires_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancellationStage: (row.cancellation_stage as Delivery['cancellationStage']) ?? null,
    cancellationFee: (row.cancellation_fee as number | null) ?? null,
    cancellationReason: (row.cancellation_reason as string | null) ?? null,
    distanceKm: (row.distance_km as number | null) ?? null,
    tripId: (row.trip_id as string | null) ?? null,
    tripOrder: (row.trip_order as number | null) ?? null,
    // Admin assignment tracking
    assignedAt: (row.assigned_at as string | null) ?? null,
    assignedBy: (row.assigned_by as string | null) ?? null,
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
    // Driver pay tracking
    driverPayEnabled: !!row.driver_pay_enabled,
    // SMS feature toggles
    smsNotifyEnRoutePickup: row.sms_notify_en_route_pickup !== false,
    smsNotifyPickedUp: row.sms_notify_picked_up !== false,
    smsNotifyFailedAttempt: row.sms_notify_failed_attempt !== false,
    smsNotifyCancelled: row.sms_notify_cancelled !== false,
    smsNotifyReassigned: row.sms_notify_reassigned !== false,
    smsNotifyFeedbackRequest: row.sms_notify_feedback_request !== false,
    smsNotifyInvoiceReady: row.sms_notify_invoice_ready !== false,
    smsNotifyPaymentReceived: row.sms_notify_payment_received !== false,
    smsNotifyWeeklySummary: !!row.sms_notify_weekly_summary,
    smsOptOutManagement: row.sms_opt_out_management !== false,
    smsShiftReminder: !!row.sms_shift_reminder,
    smsEarningsSummary: !!row.sms_earnings_summary,
    // Dispatch mode
    allowDriverSelfClaim: row.allow_driver_self_claim !== false,
    // Invoice template settings
    invoiceCompanyName: (row.invoice_company_name as string) || 'LV Couriers',
    invoiceCompanyAddress: (row.invoice_company_address as string) || '',
    invoiceCompanyPhone: (row.invoice_company_phone as string) || '',
    invoiceCompanyEmail: (row.invoice_company_email as string) || 'billing@lv-couriers.local',
    invoiceTaxNumber: (row.invoice_tax_number as string) || '',
    invoiceTaxLabel: (row.invoice_tax_label as string) || 'GST',
    invoiceTaxRate: (row.invoice_tax_rate as number) ?? 5,
    invoicePaymentTerms: (row.invoice_payment_terms as string) || 'Net 15',
    invoicePaymentInstructions: (row.invoice_payment_instructions as string) || '',
    invoiceBankName: (row.invoice_bank_name as string) || '',
    invoiceBankAccountName: (row.invoice_bank_account_name as string) || '',
    invoiceBankAccountNumber: (row.invoice_bank_account_number as string) || '',
    invoiceBankTransitNumber: (row.invoice_bank_transit_number as string) || '',
    invoiceBankInstitutionNumber: (row.invoice_bank_institution_number as string) || '',
    invoiceFooterNotes: (row.invoice_footer_notes as string) || '',
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
    gstAmount: Number(row.gst_total) || 0,
    total: Number(row.total) || 0,
    status: (row.status as InvoiceStatus) || 'draft',
    dueDate: (row.due_date as string) || '',
    paidDate: (row.paid_at as string | null) ?? null,
    paymentMethod: (row.payment_method as string | null) ?? null,
    paymentReference: (row.payment_reference as string | null) ?? null,
    amountReceived: null,
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
  return (data || []).map((row: Row) => mapDeliveryRow(row))
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
  return (data || []).map((row: Row) => mapInvoiceRow(row))
}

// ============================================================================
// Mutations
// ============================================================================

export async function createDeliveryInDb(input: {
  businessId: string
  locationId: string
  pickupAddress: string
  pickupArea: string
  pickupPostalCode?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffAddress: string
  dropoffArea: string
  dropoffPostalCode?: string | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  recipientName?: string | null
  recipientPhone?: string | null
  recipientNote?: string | null
  buzzCode?: string | null
  isRush: boolean
  isOutOfTown: boolean
  isUrgent?: boolean
  requireSignature?: boolean
  requirePhoto?: boolean
  manifest: Array<{ type: ManifestItem['type']; quantity: number; notes?: string }>
  distanceKm?: number | null
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
      pickup_postal_code: input.pickupPostalCode ?? null,
      pickup_lat: input.pickupLat ?? null,
      pickup_lng: input.pickupLng ?? null,
      dropoff_address: input.dropoffAddress,
      dropoff_area: input.dropoffArea,
      dropoff_postal_code: input.dropoffPostalCode ?? null,
      dropoff_lat: input.dropoffLat ?? null,
      dropoff_lng: input.dropoffLng ?? null,
      recipient_name: input.recipientName ?? null,
      recipient_phone: input.recipientPhone ?? null,
      recipient_note: input.recipientNote ?? null,
      buzz_code: input.buzzCode ?? null,
      is_rush: input.isRush,
      is_urgent: input.isUrgent ?? input.isRush,
      is_out_of_town: input.isOutOfTown,
      require_signature: input.requireSignature ?? false,
      require_photo: input.requirePhoto ?? true,
      distance_km: input.distanceKm ?? null,
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
    // billing_email and backup_email are stored on business_locations, not rate_cards
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

/**
 * Update billing email info for a business location.
 * This is separate from rate cards since billing emails live on business_locations table.
 */
export async function updateLocationBillingEmails(
  locationId: string,
  billingEmail: string,
  backupEmail: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('business_locations')
    .update({
      billing_email: billingEmail,
      backup_email: backupEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId)
  if (error) throw error
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
  // Driver pay tracking
  if (partial.driverPayEnabled != null) p.driver_pay_enabled = partial.driverPayEnabled
  // SMS feature toggles
  if (partial.smsNotifyEnRoutePickup != null) p.sms_notify_en_route_pickup = partial.smsNotifyEnRoutePickup
  if (partial.smsNotifyPickedUp != null) p.sms_notify_picked_up = partial.smsNotifyPickedUp
  if (partial.smsNotifyFailedAttempt != null) p.sms_notify_failed_attempt = partial.smsNotifyFailedAttempt
  if (partial.smsNotifyCancelled != null) p.sms_notify_cancelled = partial.smsNotifyCancelled
  if (partial.smsNotifyReassigned != null) p.sms_notify_reassigned = partial.smsNotifyReassigned
  if (partial.smsNotifyFeedbackRequest != null) p.sms_notify_feedback_request = partial.smsNotifyFeedbackRequest
  if (partial.smsNotifyInvoiceReady != null) p.sms_notify_invoice_ready = partial.smsNotifyInvoiceReady
  if (partial.smsNotifyPaymentReceived != null) p.sms_notify_payment_received = partial.smsNotifyPaymentReceived
  if (partial.smsNotifyWeeklySummary != null) p.sms_notify_weekly_summary = partial.smsNotifyWeeklySummary
  if (partial.smsOptOutManagement != null) p.sms_opt_out_management = partial.smsOptOutManagement
  if (partial.smsShiftReminder != null) p.sms_shift_reminder = partial.smsShiftReminder
  if (partial.smsEarningsSummary != null) p.sms_earnings_summary = partial.smsEarningsSummary
  // Dispatch mode
  if (partial.allowDriverSelfClaim != null) p.allow_driver_self_claim = partial.allowDriverSelfClaim
  // Invoice template settings
  if (partial.invoiceCompanyName != null) p.invoice_company_name = partial.invoiceCompanyName
  if (partial.invoiceCompanyAddress != null) p.invoice_company_address = partial.invoiceCompanyAddress
  if (partial.invoiceCompanyPhone != null) p.invoice_company_phone = partial.invoiceCompanyPhone
  if (partial.invoiceCompanyEmail != null) p.invoice_company_email = partial.invoiceCompanyEmail
  if (partial.invoiceTaxNumber != null) p.invoice_tax_number = partial.invoiceTaxNumber
  if (partial.invoiceTaxLabel != null) p.invoice_tax_label = partial.invoiceTaxLabel
  if (partial.invoiceTaxRate != null) p.invoice_tax_rate = partial.invoiceTaxRate
  if (partial.invoicePaymentTerms != null) p.invoice_payment_terms = partial.invoicePaymentTerms
  if (partial.invoicePaymentInstructions != null) p.invoice_payment_instructions = partial.invoicePaymentInstructions
  if (partial.invoiceBankName != null) p.invoice_bank_name = partial.invoiceBankName
  if (partial.invoiceBankAccountName != null) p.invoice_bank_account_name = partial.invoiceBankAccountName
  if (partial.invoiceBankAccountNumber != null) p.invoice_bank_account_number = partial.invoiceBankAccountNumber
  if (partial.invoiceBankTransitNumber != null) p.invoice_bank_transit_number = partial.invoiceBankTransitNumber
  if (partial.invoiceBankInstitutionNumber != null) p.invoice_bank_institution_number = partial.invoiceBankInstitutionNumber
  if (partial.invoiceFooterNotes != null) p.invoice_footer_notes = partial.invoiceFooterNotes

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
  const firstLoc = business.locations[0]
  const { error } = await supabase.from('businesses').upsert({
    id: business.id,
    name: business.name,
    invoice_format: business.invoiceFormat,
    invite_status: business.inviteStatus,
    // Required NOT NULL columns — use first-location contact as sensible default.
    contact_name: firstLoc?.contactName || business.name,
    phone: firstLoc?.phone || '',
    email: firstLoc?.billingEmail || '',
  })
  if (error) throw error

  for (const loc of business.locations) {
    const { error: le } = await supabase.from('business_locations').upsert({
      id: loc.id,
      business_id: business.id,
      name: loc.name,
      address: loc.address,
      area: loc.name, // Use location name as area if not otherwise specified
      billing_email: loc.billingEmail,
      backup_email: loc.backupEmail,
      contact_name: loc.contactName,
      phone: loc.phone,
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
    area: loc.name,
    billing_email: loc.billingEmail,
    backup_email: loc.backupEmail,
    contact_name: loc.contactName,
    phone: loc.phone,
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
  // DB has only `quantity` on manifest_items — we overwrite it with the
  // confirmed count at pickup. Verification photos are stored in
  // delivery_flags (qty_adjusted) rather than per-item.
  for (const v of verifications) {
    const { error } = await supabase
      .from('manifest_items')
      .update({ quantity: v.confirmedQty })
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
    notes: flag.description,
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

// ============================================================================
// TURN 2: saved_contacts, admin_notifications, sms_log, invoice_disputes
// ============================================================================

// ---------- saved_contacts -------------------------------------------------

export function mapSavedContactRow(row: Row): SavedContact {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    address: row.address as string,
    area: (row.area as string | null) ?? null,
    buzzCode: (row.buzz_code as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    useCount: Number(row.use_count) || 0,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function loadSavedContacts(profile: {
  role: string
  businessId: string | null
}): Promise<SavedContact[]> {
  const supabase = createClient()
  // Admin sees all contacts; other roles rely on RLS to filter. Drivers get an
  // empty list by design (they don't need saved contacts).
  if (profile.role === 'driver') return []
  let query = supabase
    .from('saved_contacts')
    .select('*')
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(500)
  if (profile.role === 'business' && profile.businessId) {
    query = query.eq('business_id', profile.businessId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((r: Row) => mapSavedContactRow(r))
}

export async function upsertSavedContact(contact: SavedContact): Promise<SavedContact> {
  const supabase = createClient()
  // If the client generated a non-UUID id (e.g. `contact-<ts>-<rand>` from the
  // legacy in-memory flow), let Postgres assign a real UUID so future updates
  // can target it by primary key.
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contact.id)
  const payload: Record<string, unknown> = {
    business_id: contact.businessId,
    name: contact.name,
    phone: contact.phone,
    address: contact.address,
    area: contact.area,
    buzz_code: contact.buzzCode,
    notes: contact.notes,
    use_count: contact.useCount,
    last_used_at: contact.lastUsedAt,
  }
  if (looksLikeUuid) payload.id = contact.id

  const { data, error } = await supabase
    .from('saved_contacts')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return mapSavedContactRow(data as Row)
}

export async function deleteSavedContactRow(contactId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('saved_contacts').delete().eq('id', contactId)
  if (error) throw error
}

// ---------- admin_notifications --------------------------------------------

export function mapAdminNotificationRow(row: Row): AdminNotification {
  return {
    id: row.id as string,
    type: (row.notification_type as AdminNotificationType) || 'system',
    title: row.title as string,
    message: row.message as string,
    deliveryId: (row.delivery_id as string | null) ?? null,
    driverId: (row.driver_id as string | null) ?? null,
    businessId: (row.business_id as string | null) ?? null,
    invoiceId: (row.invoice_id as string | null) ?? null,
    priority: ((row.priority as AdminNotification['priority']) || 'medium'),
    read: Boolean(row.is_read),
    createdAt: row.created_at as string,
  }
}

export async function loadAdminNotifications(profile: {
  role: string
}): Promise<AdminNotification[]> {
  const supabase = createClient()
  // Admin-only. RLS will reject other roles; skip the round-trip.
  if (profile.role !== 'admin') return []
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data || []).map((r: Row) => mapAdminNotificationRow(r))
}

export async function insertAdminNotification(
  input: Omit<AdminNotification, 'id' | 'createdAt'>,
): Promise<AdminNotification> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('admin_notifications')
    .insert({
      notification_type: input.type,
      title: input.title,
      message: input.message,
      delivery_id: input.deliveryId,
      driver_id: input.driverId,
      business_id: input.businessId,
      invoice_id: input.invoiceId,
      priority: input.priority,
      is_read: input.read,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapAdminNotificationRow(data as Row)
}

export async function markAdminNotificationReadInDb(
  notificationId: string,
  allMode: boolean,
): Promise<void> {
  const supabase = createClient()
  const q = supabase.from('admin_notifications').update({ is_read: true })
  const { error } = allMode ? await q.eq('is_read', false) : await q.eq('id', notificationId)
  if (error) throw error
}

// ---------- sms_log --------------------------------------------------------

export function mapSMSRow(row: Row): SMSLogEntry {
  return {
    id: row.id as string,
    deliveryId: (row.delivery_id as string | null) ?? null,
    invoiceId: (row.invoice_id as string | null) ?? null,
    recipientName: '', // column doesn't exist on DB; derive client-side if needed
    recipientPhone: row.recipient_phone as string,
    type: (row.sms_type as SMSType) || 'tracking_link',
    message: row.message_body as string,
    status: (row.status as SMSStatus) || 'sent',
    sentAt: row.sent_at as string,
    deliveredAt: null, // DB only tracks sent_at; delivered_at not modelled
    errorMessage: (row.error_message as string | null) ?? null,
  }
}

export async function loadSMSLog(profile: {
  role: string
}): Promise<SMSLogEntry[]> {
  const supabase = createClient()
  if (profile.role === 'driver') return [] // drivers don't view SMS log
  const { data, error } = await supabase
    .from('sms_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data || []).map((r: Row) => mapSMSRow(r))
}

export async function insertSMSLog(
  entry: Omit<SMSLogEntry, 'id'>,
): Promise<SMSLogEntry> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sms_log')
    .insert({
      delivery_id: entry.deliveryId,
      invoice_id: entry.invoiceId,
      recipient_phone: entry.recipientPhone,
      sms_type: entry.type,
      message_body: entry.message,
      status: entry.status,
      error_message: entry.errorMessage,
      sent_at: entry.sentAt || new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error
  return mapSMSRow(data as Row)
}

export async function markSMSRetriedInDb(smsId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('sms_log')
    .update({
      status: 'sent',
      error_message: null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', smsId)
  if (error) throw error
}

// ---------- invoice_disputes -----------------------------------------------

// DB enum is 'open' | 'accepted' | 'rejected'; app uses resolved_accepted/rejected.
function mapDbDisputeStatusToApp(s: string): DisputeStatus {
  if (s === 'accepted') return 'resolved_accepted'
  if (s === 'rejected') return 'resolved_rejected'
  return 'open'
}

function mapAppDisputeStatusToDb(s: DisputeStatus): string {
  if (s === 'resolved_accepted') return 'accepted'
  if (s === 'resolved_rejected') return 'rejected'
  return 'open'
}

export function mapDisputeRow(row: Row, ctx: {
  invoiceNumber: string
  businessId: string
  businessName: string
  lineItemDescription: string
}): Dispute {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    invoiceNumber: ctx.invoiceNumber,
    lineItemId: (row.line_item_id as string) || '',
    lineItemDescription: ctx.lineItemDescription,
    businessId: ctx.businessId,
    businessName: ctx.businessName,
    claim: row.reason as string,
    photoUrl: (row.photo_url as string | null) ?? null,
    status: mapDbDisputeStatusToApp(row.status as string),
    adminResponse: (row.resolution_notes as string | null) ?? null,
    creditAmount: row.credit_amount != null ? Number(row.credit_amount) : null,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
  }
}

export async function loadDisputes(
  invoices: Invoice[],
): Promise<Dispute[]> {
  // Enrichment context (invoiceNumber/businessName/lineItemDescription) lives
  // on the already-hydrated invoices array, so we resolve it in-memory after
  // fetching the dispute rows. This keeps the query simple + RLS-compatible.
  const supabase = createClient()
  const { data, error } = await supabase
    .from('invoice_disputes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error

  const invoicesById = new Map(invoices.map(i => [i.id, i]))
  return (data || []).map((r: Row) => {
    const inv = invoicesById.get(r.invoice_id as string)
    const line = inv?.lines.find(l => l.id === (r.line_item_id as string))
    return mapDisputeRow(r, {
      invoiceNumber: inv?.invoiceNumber || '',
      businessId: inv?.businessId || '',
      businessName: inv?.businessName || '',
      lineItemDescription: line?.description || '',
    })
  })
}

export async function insertDispute(input: {
  invoiceId: string
  lineItemId: string
  claim: string
  photoUrl: string | null
}): Promise<{ id: string; createdAt: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('invoice_disputes')
    .insert({
      invoice_id: input.invoiceId,
      line_item_id: input.lineItemId,
      reason: input.claim,
      photo_url: input.photoUrl,
      status: 'open',
    })
    .select('id, created_at')
    .single()
  if (error) throw error
  const row = data as Row
  return { id: row.id as string, createdAt: row.created_at as string }
}

export async function resolveDisputeInDb(
  disputeId: string,
  action: 'accept' | 'reject',
  adminNote: string,
  creditAmount: number | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('invoice_disputes')
    .update({
      status: mapAppDisputeStatusToDb(action === 'accept' ? 'resolved_accepted' : 'resolved_rejected'),
      resolution_notes: adminNote,
      credit_amount: action === 'accept' ? creditAmount ?? 0 : null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)
  if (error) throw error
}

export async function updateInvoiceStatusOnly(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
  if (error) throw error
}

/**
 * Create a new invoice in the database along with its line items.
 */
export async function createInvoiceInDb(invoice: Invoice): Promise<void> {
  const supabase = createClient()
  const now = new Date().toISOString()
  
  console.log('[v0] createInvoiceInDb: Creating invoice', invoice.id, invoice.invoiceNumber)
  
  // Insert the invoice
  const { error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      business_id: invoice.businessId,
      location_id: invoice.locationId,
      billing_email: invoice.billingEmail || null,
      backup_billing_email: invoice.backupBillingEmail || null,
      period_start: invoice.periodStart,
      period_end: invoice.periodEnd,
      subtotal: invoice.subtotal,
      gst_total: invoice.gstAmount,
      total: invoice.total,
      status: invoice.status,
      due_date: invoice.dueDate,
      sent_at: invoice.sentAt || null,
      paid_at: invoice.paidDate || null,
      payment_method: invoice.paymentMethod || null,
      payment_reference: invoice.paymentReference || null,
      reminders_paused: invoice.remindersPaused || false,
      email_bounced: invoice.emailBounced || false,
      created_at: now,
      updated_at: now,
    })
  
  if (invoiceError) {
    console.error('[v0] createInvoiceInDb: Failed to insert invoice:', invoiceError.message)
    throw invoiceError
  }
  
  console.log('[v0] createInvoiceInDb: Invoice inserted successfully')
  
  // Insert line items
  if (invoice.lines && invoice.lines.length > 0) {
    console.log('[v0] createInvoiceInDb: Inserting', invoice.lines.length, 'line items')
    const lineItems = invoice.lines.map((line, idx) => ({
      invoice_id: invoice.id,
      description: line.description,
      delivery_type: line.deliveryType || null,
      quantity: line.quantity,
      rate: line.rate,
      subtotal: line.total,
      delivery_ids: line.deliveryIds || [],
      sort_order: idx,
    }))
    
    const { error: linesError } = await supabase
      .from('invoice_line_items')
      .insert(lineItems)
    
    if (linesError) {
      console.error('[v0] createInvoiceInDb: Failed to insert line items:', linesError.message)
      throw linesError
    }
    console.log('[v0] createInvoiceInDb: Line items inserted successfully')
  }
  
  // Log the generated event
  const { error: eventError } = await supabase
    .from('invoice_events')
    .insert({
      invoice_id: invoice.id,
      event_type: 'generated',
      occurred_at: now,
    })
  
  if (eventError) console.error('[v0] Failed to log invoice generated event:', eventError)
}

// ============================================================================
// CUSTOMER FEEDBACK
// ============================================================================

export function mapCustomerFeedbackRow(row: Row): CustomerFeedback {
  return {
    id: row.id as string,
    deliveryId: row.delivery_id as string,
    driverId: row.driver_id as string,
    businessId: row.business_id as string,
    locationId: row.location_id as string,
    token: row.token as string,
    tokenExpiresAt: row.token_expires_at as string,
    driverRating: (row.driver_rating as number | null) ?? null,
    businessRating: (row.business_rating as number | null) ?? null,
    driverProfessionalism: (row.driver_professionalism as number | null) ?? null,
    driverTimeliness: (row.driver_timeliness as number | null) ?? null,
    driverPackageHandling: (row.driver_package_handling as number | null) ?? null,
    businessPackaging: (row.business_packaging as number | null) ?? null,
    businessAccuracy: (row.business_accuracy as number | null) ?? null,
    comment: (row.comment as string | null) ?? null,
    reportedIssues: (row.reported_issues as { issues: string[] } | null) ?? null,
    issueDetails: (row.issue_details as string | null) ?? null,
    feedbackReceived: !!row.feedback_received,
    submittedAt: (row.submitted_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function mapDriverRatingsSummaryRow(row: Row): DriverRatingsSummary {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    avgOverallRating: (row.avg_overall_rating as number | null) ?? null,
    totalRatings: (row.total_ratings as number) ?? 0,
    avgProfessionalism: (row.avg_professionalism as number | null) ?? null,
    avgTimeliness: (row.avg_timeliness as number | null) ?? null,
    avgPackageHandling: (row.avg_package_handling as number | null) ?? null,
    totalFeedback: (row.total_feedback as number) ?? 0,
    feedbackReceivedCount: (row.feedback_received_count as number) ?? 0,
    updatedAt: row.updated_at as string,
  }
}

export function mapBusinessRatingsSummaryRow(row: Row): BusinessRatingsSummary {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    locationId: row.location_id as string,
    avgOverallRating: (row.avg_overall_rating as number | null) ?? null,
    totalRatings: (row.total_ratings as number) ?? 0,
    avgPackaging: (row.avg_packaging as number | null) ?? null,
    avgAccuracy: (row.avg_accuracy as number | null) ?? null,
    totalFeedback: (row.total_feedback as number) ?? 0,
    feedbackReceivedCount: (row.feedback_received_count as number) ?? 0,
    updatedAt: row.updated_at as string,
  }
}

/**
 * Create a feedback token for a delivery
 * Token expires in 7 days
 */
export async function createFeedbackToken(
  deliveryId: string,
  driverId: string,
  businessId: string,
  locationId: string,
): Promise<string> {
  const supabase = createClient()
  
  // Generate a secure random token
  const token = `fb_${crypto.getRandomValues(new Uint8Array(24)).reduce((a, b) => a + (b % 36).toString(36), '')}`
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  
  const { data, error } = await supabase
    .from('customer_feedback')
    .insert({
      delivery_id: deliveryId,
      driver_id: driverId,
      business_id: businessId,
      location_id: locationId,
      token,
      token_expires_at: expiresAt.toISOString(),
      feedback_received: false,
    })
    .select('token')
    .single()
  
  if (error) {
    console.error('[v0] Failed to create feedback token:', error.message)
    throw error
  }
  
  return data.token
}

/**
 * Get feedback by token (for public feedback form)
 */
export async function getFeedbackByToken(token: string): Promise<CustomerFeedback | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customer_feedback')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  
  if (error) {
    console.error('[v0] Failed to fetch feedback by token:', error?.message)
    return null
  }
  
  if (!data) {
    return null
  }
  
  return mapCustomerFeedbackRow(data)
}

/**
 * Submit customer feedback
 */
export async function submitCustomerFeedback(
  feedbackId: string,
  driverRating: number,
  businessRating: number,
  driverProfessionalism: number | null,
  driverTimeliness: number | null,
  driverPackageHandling: number | null,
  businessPackaging: number | null,
  businessAccuracy: number | null,
  comment: string | null,
  reportedIssues: { issues: string[] } | null,
  issueDetails: string | null,
): Promise<CustomerFeedback> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customer_feedback')
    .update({
      driver_rating: driverRating,
      business_rating: businessRating,
      driver_professionalism: driverProfessionalism,
      driver_timeliness: driverTimeliness,
      driver_package_handling: driverPackageHandling,
      business_packaging: businessPackaging,
      business_accuracy: businessAccuracy,
      comment,
      reported_issues: reportedIssues,
      issue_details: issueDetails,
      feedback_received: true,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)
    .select('*')
    .single()
  
  if (error) {
    console.error('[v0] Failed to submit feedback:', error.message)
    throw error
  }
  
  return mapCustomerFeedbackRow(data)
}

/**
 * Get all feedback for a driver
 */
export async function getDriverFeedback(driverId: string): Promise<CustomerFeedback[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customer_feedback')
    .select('*')
    .eq('driver_id', driverId)
    .eq('feedback_received', true)
    .order('submitted_at', { ascending: false })
  
  if (error) {
    console.error('[v0] Failed to fetch driver feedback:', error.message)
    return []
  }
  
  return (data || []).map(mapCustomerFeedbackRow)
}

/**
 * Get feedback for a business location
 */
export async function getBusinessLocationFeedback(businessId: string, locationId: string): Promise<CustomerFeedback[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customer_feedback')
    .select('*')
    .eq('business_id', businessId)
    .eq('location_id', locationId)
    .eq('feedback_received', true)
    .order('submitted_at', { ascending: false })
  
  if (error) {
    console.error('[v0] Failed to fetch business feedback:', error.message)
    return []
  }
  
  return (data || []).map(mapCustomerFeedbackRow)
}

/**
 * Get driver ratings summary
 */
export async function getDriverRatingsSummary(driverId: string): Promise<DriverRatingsSummary | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('driver_ratings_summary')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()
  
  if (error) {
    console.error('[v0] Failed to fetch driver ratings summary:', error.message)
    return null
  }
  
  return data ? mapDriverRatingsSummaryRow(data) : null
}

/**
 * Get business ratings summary for a location
 */
export async function getBusinessRatingsSummary(businessId: string, locationId: string): Promise<BusinessRatingsSummary | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('business_ratings_summary')
    .select('*')
    .eq('business_id', businessId)
    .eq('location_id', locationId)
    .maybeSingle()
  
  if (error) {
    console.error('[v0] Failed to fetch business ratings summary:', error.message)
    return null
  }
  
  return data ? mapBusinessRatingsSummaryRow(data) : null
}

// ============================================================================
// Radius Pricing Tiers
// ============================================================================

/**
 * Get all radius pricing tiers for a location
 */
export async function getRadiusTiers(locationId: string): Promise<RadiusPricingTier[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('radius_pricing_tiers')
    .select('*')
    .eq('location_id', locationId)
    .order('max_distance_km', { ascending: true })

  if (error) {
    console.error('[v0] Failed to fetch radius tiers:', error.message)
    return []
  }

  return (data || []).map(mapRadiusTierRow)
}

/**
 * Create or update a radius pricing tier
 */
export async function upsertRadiusTier(
  tier: Omit<RadiusPricingTier, 'id'> & { id?: string }
): Promise<RadiusPricingTier | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('radius_pricing_tiers')
    .upsert({
      id: tier.id,
      location_id: tier.locationId,
      max_distance_km: tier.maxDistanceKm,
      rate_regular: tier.rateRegular,
      rate_rush: tier.rateRush,
      rate_big_parcel: tier.rateBigParcel,
      rate_rush_big: tier.rateRushBig,
      label: tier.label,
      sort_order: tier.sortOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('[v0] Failed to upsert radius tier:', error.message)
    return null
  }

  return mapRadiusTierRow(data)
}

/**
 * Delete a radius pricing tier
 */
export async function deleteRadiusTier(tierId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('radius_pricing_tiers')
    .delete()
    .eq('id', tierId)

  if (error) {
    console.error('[v0] Failed to delete radius tier:', error.message)
    return false
  }

  return true
}

/**
 * Delete all radius tiers for a location
 */
export async function deleteAllRadiusTiers(locationId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('radius_pricing_tiers')
    .delete()
    .eq('location_id', locationId)

  if (error) {
    console.error('[v0] Failed to delete radius tiers:', error.message)
    return false
  }

  return true
}

/**
 * Save all radius tiers for a location (replaces existing)
 */
export async function saveRadiusTiers(
  locationId: string,
  tiers: Array<Omit<RadiusPricingTier, 'id' | 'locationId' | 'sortOrder'> & { sortOrder?: number }>
): Promise<RadiusPricingTier[]> {
  const supabase = createClient()

  // Delete existing tiers
  await deleteAllRadiusTiers(locationId)

  if (tiers.length === 0) return []

  // Insert new tiers
  const { data, error } = await supabase
    .from('radius_pricing_tiers')
    .insert(
      tiers.map((tier, index) => ({
        location_id: locationId,
        max_distance_km: tier.maxDistanceKm,
        rate_regular: tier.rateRegular,
        rate_rush: tier.rateRush,
        rate_big_parcel: tier.rateBigParcel,
        rate_rush_big: tier.rateRushBig,
        label: tier.label,
        sort_order: index,
      }))
    )
    .select()

  if (error) {
    console.error('[v0] Failed to save radius tiers:', error.message)
    return []
  }

  return (data || []).map(mapRadiusTierRow)
}

/**
 * Update business location coordinates
 */
export async function updateLocationCoordinates(
  locationId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('business_locations')
    .update({ lat, lng })
    .eq('id', locationId)

  if (error) {
    console.error('Failed to update location coordinates:', error.message)
    return false
  }

  return true
}

/**
 * Update delivery distance
 */
export async function updateDeliveryDistance(
  deliveryId: string,
  distanceKm: number
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('deliveries')
    .update({ distance_km: distanceKm })
    .eq('id', deliveryId)

  if (error) {
    console.error('[v0] Failed to update delivery distance:', error.message)
    return false
  }

  return true
}
