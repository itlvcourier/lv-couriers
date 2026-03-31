// Delivery status progression
export type DeliveryStatus =
  | 'posted'
  | 'claimed'
  | 'in_transit'
  | 'delivered'
  | 'failed'

export type PackageSize = 'small' | 'medium' | 'large'

export type Priority = 'standard' | 'rush'

export type DriverStatus = 'available' | 'on_delivery' | 'offline'

export type UserRole = 'driver' | 'business' | 'admin'

export type VehicleType = 'car' | 'van' | 'bike' | 'truck'

// Database types matching Supabase schema
export interface DbBusiness {
  id: string
  user_id: string | null
  name: string
  address: string
  phone: string | null
  email: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface DbDriver {
  id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  avatar: string | null
  status: DriverStatus
  vehicle_type: VehicleType
  license_plate: string | null
  total_deliveries: number
  today_deliveries: number
  rating: number
  created_at: string
  updated_at: string
}

export interface DbDelivery {
  id: string
  business_id: string
  driver_id: string | null
  bundle_id: string | null
  pickup_address: string
  pickup_contact: string
  pickup_phone: string | null
  pickup_notes: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_address: string
  dropoff_contact: string
  dropoff_phone: string | null
  dropoff_notes: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  package_size: PackageSize
  package_description: string | null
  payout: number
  distance: string | null
  status: DeliveryStatus
  priority: Priority
  posted_at: string
  claimed_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  duration: string | null
  proof_photo_url: string | null
  fail_reason: string | null
  created_at: string
  updated_at: string
  // Joined fields
  business?: DbBusiness
  driver?: DbDriver
}

export interface DbStatusHistory {
  id: string
  delivery_id: string
  status: DeliveryStatus
  note: string | null
  timestamp: string
}

export interface DbActivityEvent {
  id: string
  delivery_id: string
  driver_id: string | null
  business_id: string | null
  driver_name: string | null
  business_name: string | null
  action: string
  status: DeliveryStatus
  created_at: string
}

export interface DbDriverLocation {
  id: string
  driver_id: string
  delivery_id: string | null
  latitude: number
  longitude: number
  heading: number | null
  speed: number | null
  updated_at: string
}

// Form types
export interface NewDeliveryForm {
  pickup_address: string
  pickup_contact: string
  pickup_phone: string
  pickup_notes: string
  dropoff_address: string
  dropoff_contact: string
  dropoff_phone: string
  dropoff_notes: string
  package_size: PackageSize
  package_description: string
  payout: number
  priority: Priority
}

export interface InviteDriverForm {
  name: string
  email: string
  phone: string
  vehicle_type: VehicleType
}

export type FailReason =
  | 'No one home'
  | 'Wrong address'
  | 'Package refused'
  | 'Unable to access location'
  | 'Other'

// Bundle type for grouped deliveries
export interface DeliveryBundle {
  bundle_id: string
  pickup_address: string
  business_name: string
  deliveries: DbDelivery[]
  total_payout: number
}
