// Delivery status progression
export type DeliveryStatus =
  | 'posted'
  | 'claimed'
  | 'en_route_pickup'
  | 'picked_up'
  | 'en_route_dropoff'
  | 'delivered'
  | 'failed'

export type PackageType =
  | 'Document'
  | 'Parcel'
  | 'Fragile'
  | 'Large Item'
  | 'Other'

export type DriverStatus = 'available' | 'on_delivery' | 'off_duty'

export type UserRole = 'driver' | 'business' | 'admin'

export interface Driver {
  id: string
  name: string
  phone: string
  avatar: string
  status: DriverStatus
  totalDeliveries: number
  todayDeliveries: number
  averageTime: string
  joinedDate: string
}

export interface Business {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  totalDeliveries: number
  lastActive: string
}

export interface StatusEvent {
  status: DeliveryStatus
  timestamp: string
  note: string | null
}

export interface Delivery {
  id: string
  businessId: string
  businessName: string
  driverId: string | null
  driverName: string | null
  pickupAddress: string
  pickupArea: string
  dropoffAddress: string
  dropoffArea: string
  packageType: PackageType
  notes: string
  isUrgent: boolean
  status: DeliveryStatus
  postedAt: string
  claimedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  duration: string | null
  proofPhotoUrl: string | null
  statusHistory: StatusEvent[]
}

export interface NewDeliveryData {
  businessId: string
  businessName: string
  pickupAddress: string
  pickupArea: string
  dropoffAddress: string
  dropoffArea: string
  packageType: PackageType
  notes: string
  isUrgent: boolean
}

export type FailReason =
  | 'No one home'
  | 'Wrong address'
  | 'Package refused'
  | 'Unable to access location'
  | 'Other'
