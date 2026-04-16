// DOMS - Delivery Operations Management System Types

export type DeliveryStatus =
  | 'posted'
  | 'claimed'
  | 'en_route_pickup'
  | 'picked_up'
  | 'en_route_dropoff'
  | 'delivered'
  | 'failed_retry'
  | 'failed_permanent'
  | 'flagged'
  | 'cancelled'

export type ManifestItemType = 'small_package' | 'big_package' | 'out_of_town' | 'rush'

export type DriverStatus = 'available' | 'on_delivery' | 'off_duty'

export type UserRole = 'admin' | 'driver' | 'business'

export type InviteStatus = 'active' | 'pending' | 'deactivated'

export interface MockUser {
  email: string
  password: string
  role: UserRole
  name: string
  driverId?: string
  businessId?: string
  locationId?: string
}

export interface Driver {
  id: string
  userId: string | null // Links to auth.users
  name: string
  phone: string
  email: string
  status: DriverStatus
  maxJobsOverride: number | null
  // Cached stats (updated by trigger on delivery completion)
  totalDeliveries: number
  todayDeliveries: number
  monthDeliveries: number
  averageTime: string // avg_delivery_mins converted to string for display
  rushSlaRate: number // percentage 0-100
  monthlyAdjustments: number
  inviteStatus: InviteStatus
  createdAt?: string
  updatedAt?: string
}

export interface SavedAddress {
  id: string
  label: string
  address: string
  area: string
  postalCode: string
  phone?: string
}

export interface BusinessLocation {
  id: string
  businessId: string
  name: string
  address: string
  billingEmail: string
  backupEmail: string
  contactName: string
  phone: string
  savedAddresses: SavedAddress[]
}

export interface Business {
  id: string
  name: string
  locations: BusinessLocation[]
  invoiceFormat: 'combined' | 'separate' | 'combined_breakdown'
  inviteStatus: InviteStatus
}

export interface ManifestItem {
  id: string
  type: ManifestItemType
  postedQty: number
  confirmedQty: number | null
  verificationPhotoUrl: string | null
  notes: string
}

export interface PickupVerification {
  itemId: string
  confirmedQty: number
  photoUrl: string | null
  outOfTown: boolean
}

export interface DeliveryFlag {
  id: string
  type: 'wrong_items' | 'qty_adjusted' | 'location_override' | 'access_issue' | 'other'
  driverNote: string
  photoUrl: string | null
  status: 'open' | 'resolved'
  resolution: string | null
  createdAt: string
}

export interface StatusEvent {
  status: DeliveryStatus
  timestamp: string
  note: string | null
  gpsLat: number | null
  gpsLng: number | null
}

export interface Delivery {
  id: string
  businessId: string
  locationId: string
  businessName: string
  driverId: string | null
  driverName: string | null
  tripId?: string | null
  // Addresses
  pickupAddress: string
  pickupArea: string
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffAddress: string
  dropoffArea: string
  dropoffLat?: number | null
  dropoffLng?: number | null
  recipientName?: string | null
  recipientPhone: string | null
  buzzCode?: string | null
  // Manifest items
  manifest: ManifestItem[]
  // Delivery flags
  isUrgent: boolean
  isOutOfTown: boolean
  isRush?: boolean
  // Status
  status: DeliveryStatus
  retryCount?: number
  // Timestamps
  postedAt: string
  claimedAt: string | null
  pickupArrivedAt?: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  // Billing
  rateCardId?: string | null
  calculatedRate: number | null
  gstAmount?: number | null
  totalAmount?: number | null
  invoiceId?: string | null
  // Completion
  durationMins?: number | null
  duration: string | null // Formatted for display
  proofPhotoUrl: string | null
  recipientNote: string | null
  // Tracking
  trackingCode: string | null
  trackingExpiresAt?: string | null
  // Cancellation
  cancelledAt?: string | null
  cancellationStage?: 'before_depart' | 'en_route_pickup' | 'after_pickup' | null
  cancellationFee?: number | null
  cancellationReason?: string | null
  // Trip ordering
  tripOrder?: number | null
  // Relations (for client-side convenience)
  flags: DeliveryFlag[]
  verifications: PickupVerification[]
  statusHistory: StatusEvent[]
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface SavedContact {
  id: string
  businessId: string
  name: string
  phone: string | null
  address: string
  area: string | null
  buzzCode: string | null
  notes: string | null
  useCount: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemSettings {
  globalMaxJobs: number
  rushSlaMins: number
  intownTimeoutMins: number
  outOfTownTimeoutMins: number
  autoGenerateInvoices: boolean
  invoiceDueDays: number
  autoSendInvoices: boolean
  reminderDay1: number
  overdueDay: number
  escalationDay: number
  reviewReminderDays: number
  sendReminderEmail: boolean
  sendReminderSms: boolean
  cancellationBeforeDepart: number
  cancellationEnRoute: number
  }

export interface Notification {
  id: string
  type: 'flag' | 'timeout' | 'deactivation' | 'rate_card' | 'email_bounce' | 'qty_mismatch'
  title: string
  message: string
  deliveryId?: string
  driverId?: string
  businessId?: string
  createdAt: string
  read: boolean
}

export type FlagType = DeliveryFlag['type']

export type FailReason =
  | 'no_one_home'
  | 'wrong_address'
  | 'package_refused'
  | 'access_issue'
  | 'other'

// Calgary mock addresses for autocomplete
export const CALGARY_ADDRESSES = [
  { address: '3009 14 St SW, Calgary, AB', area: 'Beltline', postalCode: 'T2T 3V6' },
  { address: '1111 Centre St N, Calgary, AB', area: 'Crescent Heights', postalCode: 'T2E 2R2' },
  { address: '7015 Macleod Trail SW, Calgary, AB', area: 'Chinook', postalCode: 'T2H 2K6' },
  { address: '4820 Northland Dr NW, Calgary, AB', area: 'Dalhousie', postalCode: 'T2L 2L4' },
  { address: '250 Shawville Blvd SE, Calgary, AB', area: 'Shawnessy', postalCode: 'T2Y 3Z1' },
  { address: '901 64 Ave NE, Calgary, AB', area: 'Marlborough', postalCode: 'T2E 7P4' },
  { address: '5149 Country Hills Blvd NW, Calgary, AB', area: 'Country Hills', postalCode: 'T3A 5K8' },
  { address: '2525 36 St NE, Calgary, AB', area: 'Franklin', postalCode: 'T1Y 5T4' },
  { address: '8180 11 St SE, Calgary, AB', area: 'Shepard', postalCode: 'T2H 2S9' },
  { address: '130 Crowfoot Crescent NW, Calgary, AB', area: 'Crowfoot', postalCode: 'T3G 3P5' },
]

// Rate calculations (default rates)
export const RATES = {
  regular: 9,
  bigPackage1: 9,
  bigPackage2Plus: 18,
  rush: 20,
  rushOutOfTown: 30,
  outOfTown: 15,
  gst: 0.05,
}

// ===== PHASE 2: BILLING & INVOICING TYPES =====

export interface RateCard {
  id: string
  businessId: string
  locationId: string
  effectiveDate: string
  // Five rates (matching schema columns)
  rateRegular: number
  rateBigDouble: number // 2+ big packages
  rateOotBig: number | null // Out of town big (nullable = not set)
  rateRush: number
  rateRushOot: number
  // Tax
  gstApplicable: boolean
  // Cancellation fees (overrides system_settings)
  cancelBeforeDepart: number | null
  cancelEnRoute: number | null
  // Notification preferences
  notifyDriverAssigned: boolean
  notifyPickupConfirmed: boolean
  notifyEnRoute: boolean
  notifyDelivered: boolean
  notifyFailed: boolean
  notifyInvoiceSent: boolean
  notifyPaymentReminder: boolean
  notifyRecipientSms: boolean
  // Billing info (from business_locations)
  billingEmail: string
  backupEmail: string
  // Billing notes
  contractNotes: string
  createdAt: string
  updatedAt: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'disputed' | 'escalated'

export interface InvoiceLine {
  id: string
  description: string
  deliveryType: 'regular' | 'big_double' | 'out_of_town_big' | 'rush' | 'rush_out_of_town' | 'cancellation'
  quantity: number
  rate: number
  total: number
  deliveryIds: string[] // IDs of deliveries included in this line
}

export type InvoiceEventType =
  | 'generated'
  | 'sent'
  | 'opened'
  | 'reminder'       // legacy
  | 'due_reminder'   // legacy
  | 'reminder_1'
  | 'reminder_2'
  | 'overdue_notice'
  | 'overdue'        // legacy
  | 'escalated'
  | 'disputed'
  | 'dispute_resolved'
  | 'paid'
  | 'bounced'
  | 'resent'
  | 'sms_sent'
  | 'skipped'
  | 'reminders_paused'
  | 'reminders_resumed'

export interface InvoiceEmailEvent {
  id: string
  type: InvoiceEventType
  timestamp: string
  email?: string
  phone?: string
  note?: string
  isScheduled?: boolean
}

export interface Invoice {
  id: string
  invoiceNumber: string
  businessId: string
  businessName: string
  locationId: string
  locationName: string
  locationAddress: string
  billingEmail: string
  periodStart: string
  periodEnd: string
  lines: InvoiceLine[]
  subtotal: number
  gstAmount: number
  total: number
  status: InvoiceStatus
  dueDate: string
  paidDate: string | null
  paymentMethod: string | null
  paymentReference: string | null
  amountReceived: number | null
  emailLog: InvoiceEmailEvent[]
  // Send/reminder state
  sentAt: string | null
  openedAt: string | null
  remindersPaused: boolean
  remindersSkipCount: number
  emailBounced: boolean
  backupBillingEmail: string | null
  recipientPhone: string | null
  createdAt: string
  updatedAt: string
}

export type DisputeStatus = 'open' | 'resolved_accepted' | 'resolved_rejected'

export interface Dispute {
  id: string
  invoiceId: string
  invoiceNumber: string
  lineItemId: string
  lineItemDescription: string
  businessId: string
  businessName: string
  claim: string
  photoUrl: string | null
  status: DisputeStatus
  adminResponse: string | null
  creditAmount: number | null
  createdAt: string
  resolvedAt: string | null
}

export interface UnmatchedPayment {
  id: string
  amount: number
  dateReceived: string
  senderReference: string
  matchedInvoiceId: string | null
  matchedAt: string | null
}

export interface PaymentDetails {
  method: 'e_transfer' | 'cheque' | 'bank_transfer' | 'cash' | 'other'
  date: string
  reference: string
  amountReceived: number
}

// ===== PHASE 3: LIVE TRACKING & NOTIFICATIONS TYPES =====

export type SMSType = 
  | 'pickup_alert' 
  | 'tracking_link' 
  | 'delivery_confirm' 
  | 'failed_attempt' 
  | 'invoice_reminder' 
  | 'overdue_notice'

export type SMSStatus = 'sent' | 'delivered' | 'failed' | 'bounced'

export interface SMSLogEntry {
  id: string
  deliveryId: string | null
  invoiceId: string | null
  recipientName: string
  recipientPhone: string
  type: SMSType
  message: string
  status: SMSStatus
  sentAt: string
  deliveredAt: string | null
  errorMessage: string | null
}

// Notification types: matches DB schema + mock data types
export type AdminNotificationType = 
  // DB schema types
  | 'new_job'
  | 'flag' 
  | 'sla_breach'
  | 'driver_timeout'
  | 'payment_received'
  | 'system'
  // Mock data types (for local context backwards compat)
  | 'timeout'
  | 'completion'
  | 'invoice'
  | 'qty_adjustment'
  | 'driver_deactivated'

export interface AdminNotification {
  id: string
  type: AdminNotificationType
  title: string
  message: string
  deliveryId: string | null
  driverId: string | null
  businessId: string | null
  invoiceId: string | null
  createdAt: string
  read: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface DriverGPS {
  driverId: string
  lat: number
  lng: number
  heading: number
  speed: number
  battery: number
  lastUpdate: string
}

export interface NotificationSettings {
  driverAssigned: { email: boolean; sms: boolean }
  pickupConfirmed: { email: boolean; sms: boolean }
  enRouteDropoff: { email: boolean; sms: boolean }
  deliveryConfirmed: { email: boolean; sms: boolean }
  failedDelivery: { email: boolean; sms: boolean }
  invoiceSent: { email: boolean; sms: boolean }
  paymentReminder: { email: boolean; sms: boolean }
  sendTrackingLink: boolean
}

export interface ActivityFeedItem {
  id: string
  type: 'status_change' | 'gps_update' | 'sms_sent' | 'battery_warning' | 'timeout_warning' | 'email_bounced' | 'tracking_opened'
  message: string
  icon: string
  deliveryId: string | null
  driverId: string | null
  businessId: string | null
  timestamp: string
}

// ===== PHASE 4: MULTI-STOP & ADVANCED TYPES =====

export type TripStatus = 'active' | 'completed'

export interface Trip {
  id: string
  driverId: string
  deliveryIds: string[]
  status: TripStatus
  startedAt: string
  completedAt: string | null
  order: string[] // Ordered deliveryIds for display order
}

export interface DriverMonthlyReport {
  driverId: string
  driverName: string
  month: string
  totalDeliveries: number
  completedDeliveries: number
  failedDeliveries: number
  averageTime: string
  rushSlaRate: number
  adjustments: number
  weeklyBreakdown: number[] // deliveries per week [w1, w2, w3, w4]
}

export interface TimeoutWarning {
  id: string
  deliveryId: string
  driverId: string
  driverName: string
  businessName: string
  timeoutType: 'intown' | 'rush' | 'out_of_town'
  lastUpdateMinutes: number
  createdAt: string
  dismissed: boolean
}
