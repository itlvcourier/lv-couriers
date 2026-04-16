import { createClient } from '@/lib/supabase/client'
import type { 
  DeliveryStatus,
} from './types'

// ============ DATABASE TYPES ============
// These match the actual Supabase table schema

export interface DbBusiness {
  id: string
  name: string
  billing_email: string
  contact_name: string | null
  contact_phone: string | null
  invoice_format: 'combined' | 'separate' | 'combined_breakdown'
  status: 'pending' | 'active' | 'suspended'
  created_at: string
  updated_at: string
}

export interface DbLocation {
  id: string
  business_id: string
  name: string
  address: string
  billing_email: string | null
  backup_email: string | null
  contact_name: string | null
  contact_phone: string | null
  is_default: boolean
  created_at: string
}

export interface DbDriver {
  id: string
  user_id: string | null
  name: string
  email: string
  phone: string
  status: 'available' | 'on_delivery' | 'off_duty'
  max_jobs_override: number | null
  total_deliveries: number
  today_deliveries: number
  month_deliveries: number
  avg_delivery_mins: number | null
  rush_sla_rate: number | null
  invite_status: 'pending' | 'active' | 'deactivated'
  created_at: string
  updated_at: string
}

export interface DbDelivery {
  id: string
  business_id: string
  location_id: string
  driver_id: string | null
  trip_id: string | null
  status: DeliveryStatus
  pickup_address: string
  pickup_area: string
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_address: string
  dropoff_area: string
  dropoff_lat: number | null
  dropoff_lng: number | null
  recipient_name: string | null
  recipient_phone: string | null
  recipient_note: string | null
  buzz_code: string | null
  is_rush: boolean
  is_urgent: boolean
  is_out_of_town: boolean
  posted_at: string
  claimed_at: string | null
  pickup_arrived_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  duration_mins: number | null
  proof_photo_url: string | null
  rate_card_id: string | null
  calculated_rate: number | null
  gst_amount: number | null
  total_amount: number | null
  invoice_id: string | null
  tracking_code: string | null
  tracking_expires_at: string | null
  cancelled_at: string | null
  cancellation_stage: string | null
  cancellation_fee: number | null
  cancellation_reason: string | null
  retry_count: number
  trip_order: number | null
  created_at: string
  updated_at: string
  // Joined relations
  business?: DbBusiness
  location?: DbLocation
  driver?: DbDriver
}

export interface DbManifestItem {
  id: string
  delivery_id: string
  item_type: 'small_package' | 'big_package' | 'out_of_town' | 'rush'
  quantity: number
  confirmed_qty: number | null
  verification_photo_url: string | null
  notes: string | null
  created_at: string
}

export interface DbTrip {
  id: string
  driver_id: string
  status: 'active' | 'completed'
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface DbDeliveryFlag {
  id: string
  delivery_id: string
  flag_type: 'wrong_items' | 'qty_adjusted' | 'location_override' | 'access_issue' | 'other'
  description: string | null
  photo_url: string | null
  status: 'open' | 'resolved'
  resolution: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface DbAdminNotification {
  id: string
  notification_type: 'new_job' | 'flag' | 'sla_breach' | 'driver_timeout' | 'payment_received' | 'system'
  title: string
  message: string
  delivery_id: string | null
  driver_id: string | null
  business_id: string | null
  is_read: boolean
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

export interface DbActivityEvent {
  id: string
  delivery_id: string | null
  driver_id: string | null
  business_id: string | null
  driver_name: string | null
  business_name: string | null
  action: string
  status: string | null
  created_at: string
}

// ============ DELIVERIES ============

export async function getAvailableDeliveries() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(*),
      location:business_locations(*),
      manifest_items(*)
    `)
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })

  if (error) throw error
  return data as (DbDelivery & { manifest_items: DbManifestItem[] })[]
}

export async function getDriverActiveDeliveries(driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(*),
      location:business_locations(*),
      manifest_items(*)
    `)
    .eq('driver_id', driverId)
    .in('status', ['claimed', 'en_route_pickup', 'picked_up', 'en_route_dropoff'])
    .order('claimed_at', { ascending: true })

  if (error) throw error
  return data as (DbDelivery & { manifest_items: DbManifestItem[] })[]
}

export async function getDriverHistory(driverId: string, limit = 50) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(*),
      location:business_locations(*)
    `)
    .eq('driver_id', driverId)
    .in('status', ['delivered', 'failed_permanent', 'cancelled'])
    .order('delivered_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as DbDelivery[]
}

export async function getBusinessDeliveries(businessId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      driver:drivers(*),
      location:business_locations(*),
      manifest_items(*)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DbDelivery[]
}

export async function getLocationDeliveries(locationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      driver:drivers(*),
      business:businesses(*),
      manifest_items(*)
    `)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DbDelivery[]
}

export async function getAllDeliveries(status?: DeliveryStatus) {
  const supabase = createClient()
  let query = supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(*),
      location:business_locations(*),
      driver:drivers(*),
      manifest_items(*)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as DbDelivery[]
}

export async function getDelivery(deliveryId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(*),
      location:business_locations(*),
      driver:drivers(*),
      manifest_items(*),
      delivery_flags(*)
    `)
    .eq('id', deliveryId)
    .single()

  if (error) throw error
  return data as DbDelivery & { manifest_items: DbManifestItem[], delivery_flags: DbDeliveryFlag[] }
}

export async function getDeliveryByTrackingCode(code: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      business:businesses(name),
      driver:drivers(name, phone)
    `)
    .eq('tracking_code', code)
    .gt('tracking_expires_at', new Date().toISOString())
    .single()

  if (error) return null
  return data as DbDelivery
}

export async function claimDelivery(deliveryId: string, driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      driver_id: driverId,
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'posted')
    .select(`
      *,
      business:businesses(*),
      driver:drivers(*)
    `)
    .single()

  if (error) throw error
  return data as DbDelivery
}

export async function updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, additionalFields?: Record<string, unknown>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status,
      ...additionalFields,
    })
    .eq('id', deliveryId)
    .select()
    .single()

  if (error) throw error
  return data as DbDelivery
}

export async function startPickup(deliveryId: string) {
  return updateDeliveryStatus(deliveryId, 'en_route_pickup')
}

export async function arriveAtPickup(deliveryId: string) {
  return updateDeliveryStatus(deliveryId, 'picked_up', {
    pickup_arrived_at: new Date().toISOString(),
  })
}

export async function confirmPickup(deliveryId: string) {
  return updateDeliveryStatus(deliveryId, 'picked_up', {
    picked_up_at: new Date().toISOString(),
  })
}

export async function startDropoff(deliveryId: string) {
  return updateDeliveryStatus(deliveryId, 'en_route_dropoff')
}

export async function completeDelivery(deliveryId: string, proofPhotoUrl?: string) {
  const now = new Date()
  const delivery = await getDelivery(deliveryId).catch(() => null)
  
  let durationMins: number | null = null
  if (delivery?.picked_up_at) {
    const pickedUpAt = new Date(delivery.picked_up_at)
    durationMins = Math.round((now.getTime() - pickedUpAt.getTime()) / 60000)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      delivered_at: now.toISOString(),
      duration_mins: durationMins,
      proof_photo_url: proofPhotoUrl || null,
    })
    .eq('id', deliveryId)
    .select()
    .single()

  if (error) throw error
  
  // Update driver stats
  if (data.driver_id) {
    await incrementDriverDeliveries(data.driver_id)
  }
  
  return data as DbDelivery
}

export async function failDelivery(deliveryId: string, reason: string, permanent = false) {
  return updateDeliveryStatus(deliveryId, permanent ? 'failed_permanent' : 'flagged', {
    cancellation_reason: reason,
    retry_count: permanent ? 3 : undefined, // Max retries for permanent failure
  })
}

// ============ DRIVERS ============

export async function getDrivers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name')

  if (error) throw error
  return data as DbDriver[]
}

export async function getActiveDrivers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .in('status', ['available', 'on_delivery'])
    .eq('invite_status', 'active')
    .order('name')

  if (error) throw error
  return data as DbDriver[]
}

export async function getAvailableDrivers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')
    .eq('invite_status', 'active')
    .order('name')

  if (error) throw error
  return data as DbDriver[]
}

export async function getDriver(driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single()

  if (error) throw error
  return data as DbDriver
}

export async function getDriverByUserId(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as DbDriver
}

export async function updateDriverStatus(driverId: string, status: DbDriver['status']) {
  const supabase = createClient()
  const { error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', driverId)

  if (error) throw error
}

export async function incrementDriverDeliveries(driverId: string) {
  const supabase = createClient()
  const driver = await getDriver(driverId)
  const { error } = await supabase
    .from('drivers')
    .update({
      total_deliveries: (driver.total_deliveries || 0) + 1,
      today_deliveries: (driver.today_deliveries || 0) + 1,
      month_deliveries: (driver.month_deliveries || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId)
  
  if (error) throw error
}

export async function createDriver(driver: Omit<DbDriver, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single()

  if (error) throw error
  return data as DbDriver
}

// ============ BUSINESSES ============

export async function getBusinesses() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      *,
      locations:business_locations(*)
    `)
    .order('name')

  if (error) throw error
  return data as (DbBusiness & { locations: DbLocation[] })[]
}

export async function getBusiness(businessId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      *,
      locations:business_locations(*)
    `)
    .eq('id', businessId)
    .single()

  if (error) return null
  return data as DbBusiness & { locations: DbLocation[] }
}

export async function getBusinessLocations(businessId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('business_locations')
    .select('*')
    .eq('business_id', businessId)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) throw error
  return data as DbLocation[]
}

// ============ TRIPS ============

export async function getDriverTrip(driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      deliveries(*)
    `)
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .single()

  if (error) return null
  return data as DbTrip & { deliveries: DbDelivery[] }
}

export async function createTrip(driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trips')
    .insert({
      driver_id: driverId,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as DbTrip
}

export async function completeTrip(tripId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('trips')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', tripId)

  if (error) throw error
}

// ============ ADMIN NOTIFICATIONS ============

export async function getAdminNotifications(limit = 20) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as DbAdminNotification[]
}

export async function getUnreadNotificationCount() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  if (error) throw error
  return count || 0
}

export async function markNotificationRead(notificationId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function markAllNotificationsRead() {
  const supabase = createClient()
  const { error } = await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('is_read', false)

  if (error) throw error
}

// ============ DELIVERY FLAGS ============

export async function createDeliveryFlag(flag: Omit<DbDeliveryFlag, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('delivery_flags')
    .insert(flag)
    .select()
    .single()

  if (error) throw error
  return data as DbDeliveryFlag
}

export async function resolveDeliveryFlag(flagId: string, resolution: string, resolvedBy: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('delivery_flags')
    .update({
      status: 'resolved',
      resolution,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', flagId)

  if (error) throw error
}

// ============ DRIVER LOCATIONS ============

export async function updateDriverLocation(
  driverId: string, 
  latitude: number, 
  longitude: number,
  deliveryId?: string,
  heading?: number,
  speed?: number
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('driver_locations')
    .upsert({
      driver_id: driverId,
      delivery_id: deliveryId || null,
      latitude,
      longitude,
      heading: heading || null,
      speed: speed || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'driver_id',
    })

  if (error) {
    // If upsert fails, try insert
    await supabase
      .from('driver_locations')
      .insert({
        driver_id: driverId,
        delivery_id: deliveryId || null,
        latitude,
        longitude,
        heading: heading || null,
        speed: speed || null,
      })
  }
}

export async function getDriverLocation(driverId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as DbDriverLocation
}

// ============ DASHBOARD STATS ============

export async function getDashboardStats() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  
  const [
    { count: totalDeliveries },
    { count: activeDeliveries },
    { count: completedToday },
    { count: postedDeliveries },
    { count: totalDrivers },
    { count: activeDrivers },
    { count: totalBusinesses },
    { count: flaggedDeliveries },
  ] = await Promise.all([
    supabase.from('deliveries').select('*', { count: 'exact', head: true }),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).in('status', ['posted', 'claimed', 'en_route_pickup', 'picked_up', 'en_route_dropoff']),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', today),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'posted'),
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).in('status', ['available', 'on_delivery']).eq('invite_status', 'active'),
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'flagged'),
  ])

  return {
    totalDeliveries: totalDeliveries || 0,
    activeDeliveries: activeDeliveries || 0,
    completedToday: completedToday || 0,
    postedDeliveries: postedDeliveries || 0,
    totalDrivers: totalDrivers || 0,
    activeDrivers: activeDrivers || 0,
    totalBusinesses: totalBusinesses || 0,
    flaggedDeliveries: flaggedDeliveries || 0,
  }
}

// ============ REALTIME SUBSCRIPTIONS ============

export function subscribeToDeliveries(callback: (payload: unknown) => void) {
  const supabase = createClient()
  return supabase
    .channel('deliveries-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, callback)
    .subscribe()
}

export function subscribeToDriverLocations(callback: (payload: unknown) => void) {
  const supabase = createClient()
  return supabase
    .channel('driver-locations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, callback)
    .subscribe()
}

export function subscribeToAdminNotifications(callback: (payload: unknown) => void) {
  const supabase = createClient()
  return supabase
    .channel('admin-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, callback)
    .subscribe()
}
