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
  name: string
  phone: string
  email: string
  status: DriverStatus
  maxJobsOverride: number | null
  totalDeliveries: number
  todayDeliveries: number
  monthDeliveries: number
  averageTime: string
  rushSlaRate: number
  monthlyAdjustments: number
  inviteStatus: InviteStatus
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
  pickupAddress: string
  pickupArea: string
  dropoffAddress: string
  dropoffArea: string
  recipientPhone: string | null
  manifest: ManifestItem[]
  isUrgent: boolean
  isOutOfTown: boolean
  status: DeliveryStatus
  postedAt: string
  claimedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  duration: string | null
  proofPhotoUrl: string | null
  recipientNote: string | null
  calculatedRate: number | null
  flags: DeliveryFlag[]
  verifications: PickupVerification[]
  statusHistory: StatusEvent[]
  trackingCode: string | null
  tripId: string | null
  retryCount: number
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

// Rate calculations
export const RATES = {
  regular: 9,
  bigPackage1: 9,
  bigPackage2Plus: 18,
  rush: 20,
  rushOutOfTown: 30,
  outOfTown: 15,
  gst: 0.05,
}
