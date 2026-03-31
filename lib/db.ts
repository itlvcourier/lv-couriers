import { createClient } from '@/lib/supabase/client'
import type { 
  DbDelivery, 
  DbDriver, 
  DbBusiness, 
  DbActivityEvent,
  DbStatusHistory,
  DbDriverLocation,
  NewDeliveryForm,
  DeliveryStatus,
  DeliveryBundle
} from './types'

const supabase = createClient()

// ============ DELIVERIES ============

export async function getAvailableDeliveries() {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, business:businesses(*)')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })

  if (error) throw error
  return data as DbDelivery[]
}

export async function getAvailableDeliveriesGrouped(): Promise<DeliveryBundle[]> {
  const deliveries = await getAvailableDeliveries()
  
  // Group by bundle_id
  const bundleMap = new Map<string, DeliveryBundle>()
  
  for (const delivery of deliveries) {
    const bundleId = delivery.bundle_id || delivery.id
    
    if (bundleMap.has(bundleId)) {
      const bundle = bundleMap.get(bundleId)!
      bundle.deliveries.push(delivery)
      bundle.total_payout += Number(delivery.payout)
    } else {
      bundleMap.set(bundleId, {
        bundle_id: bundleId,
        pickup_address: delivery.pickup_address,
        business_name: delivery.business?.name || 'Unknown',
        deliveries: [delivery],
        total_payout: Number(delivery.payout),
      })
    }
  }
  
  return Array.from(bundleMap.values())
}

export async function getDriverActiveDeliveries(driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, business:businesses(*)')
    .eq('driver_id', driverId)
    .in('status', ['claimed', 'in_transit'])
    .order('claimed_at', { ascending: true })

  if (error) throw error
  return data as DbDelivery[]
}

export async function getDriverHistory(driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, business:businesses(*)')
    .eq('driver_id', driverId)
    .in('status', ['delivered', 'failed'])
    .order('delivered_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data as DbDelivery[]
}

export async function getBusinessDeliveries(businessId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, driver:drivers(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DbDelivery[]
}

export async function getAllDeliveries(status?: DeliveryStatus) {
  let query = supabase
    .from('deliveries')
    .select('*, business:businesses(*), driver:drivers(*)')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as DbDelivery[]
}

export async function getDelivery(deliveryId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, business:businesses(*), driver:drivers(*)')
    .eq('id', deliveryId)
    .single()

  if (error) throw error
  return data as DbDelivery
}

export async function createDelivery(businessId: string, form: NewDeliveryForm) {
  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      business_id: businessId,
      ...form,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  
  // Create activity event
  const business = await getBusiness(businessId)
  await createActivityEvent({
    delivery_id: data.id,
    business_id: businessId,
    business_name: business?.name || null,
    action: form.priority === 'rush' ? 'Rush delivery posted' : 'New delivery posted',
    status: 'posted',
  })
  
  return data as DbDelivery
}

export async function claimDelivery(deliveryId: string, driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      driver_id: driverId,
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'posted')
    .select('*, business:businesses(*), driver:drivers(*)')
    .single()

  if (error) throw error
  
  // Update driver status
  await updateDriverStatus(driverId, 'on_delivery')
  
  // Create activity event
  await createActivityEvent({
    delivery_id: deliveryId,
    driver_id: driverId,
    business_id: data.business_id,
    driver_name: data.driver?.name || null,
    business_name: data.business?.name || null,
    action: 'Job claimed',
    status: 'claimed',
  })
  
  return data as DbDelivery
}

export async function claimBundle(bundleId: string, driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      driver_id: driverId,
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('bundle_id', bundleId)
    .eq('status', 'posted')
    .select('*, business:businesses(*), driver:drivers(*)')

  if (error) throw error
  
  // Update driver status
  await updateDriverStatus(driverId, 'on_delivery')
  
  // Create activity events for each delivery
  for (const delivery of data) {
    await createActivityEvent({
      delivery_id: delivery.id,
      driver_id: driverId,
      business_id: delivery.business_id,
      driver_name: delivery.driver?.name || null,
      business_name: delivery.business?.name || null,
      action: 'Bundle claimed',
      status: 'claimed',
    })
  }
  
  return data as DbDelivery[]
}

export async function startDelivery(deliveryId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'in_transit',
      picked_up_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .select('*, business:businesses(*), driver:drivers(*)')
    .single()

  if (error) throw error
  
  await createActivityEvent({
    delivery_id: deliveryId,
    driver_id: data.driver_id,
    business_id: data.business_id,
    driver_name: data.driver?.name || null,
    business_name: data.business?.name || null,
    action: 'Package picked up',
    status: 'in_transit',
  })
  
  return data as DbDelivery
}

export async function completeDelivery(deliveryId: string, proofPhotoUrl?: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      proof_photo_url: proofPhotoUrl || null,
    })
    .eq('id', deliveryId)
    .select('*, business:businesses(*), driver:drivers(*)')
    .single()

  if (error) throw error
  
  // Check if driver has more active deliveries
  const activeDeliveries = await getDriverActiveDeliveries(data.driver_id!)
  if (activeDeliveries.length === 0) {
    await updateDriverStatus(data.driver_id!, 'available')
  }
  
  // Increment driver delivery counts
  await incrementDriverDeliveries(data.driver_id!)
  
  await createActivityEvent({
    delivery_id: deliveryId,
    driver_id: data.driver_id,
    business_id: data.business_id,
    driver_name: data.driver?.name || null,
    business_name: data.business?.name || null,
    action: 'Delivery completed',
    status: 'delivered',
  })
  
  return data as DbDelivery
}

export async function failDelivery(deliveryId: string, reason: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'failed',
      fail_reason: reason,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .select('*, business:businesses(*), driver:drivers(*)')
    .single()

  if (error) throw error
  
  // Check if driver has more active deliveries
  const activeDeliveries = await getDriverActiveDeliveries(data.driver_id!)
  if (activeDeliveries.length === 0) {
    await updateDriverStatus(data.driver_id!, 'available')
  }
  
  await createActivityEvent({
    delivery_id: deliveryId,
    driver_id: data.driver_id,
    business_id: data.business_id,
    driver_name: data.driver?.name || null,
    business_name: data.business?.name || null,
    action: `Delivery failed: ${reason}`,
    status: 'failed',
  })
  
  return data as DbDelivery
}

export async function reassignDelivery(deliveryId: string, newDriverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      driver_id: newDriverId,
    })
    .eq('id', deliveryId)
    .select('*, business:businesses(*), driver:drivers(*)')
    .single()

  if (error) throw error
  
  await createActivityEvent({
    delivery_id: deliveryId,
    driver_id: newDriverId,
    business_id: data.business_id,
    driver_name: data.driver?.name || null,
    business_name: data.business?.name || null,
    action: 'Driver reassigned',
    status: data.status,
  })
  
  return data as DbDelivery
}

// ============ DRIVERS ============

export async function getDrivers() {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name')

  if (error) throw error
  return data as DbDriver[]
}

export async function getAvailableDrivers() {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')
    .order('name')

  if (error) throw error
  return data as DbDriver[]
}

export async function getDriver(driverId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single()

  if (error) throw error
  return data as DbDriver
}

export async function getDriverByUserId(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as DbDriver
}

export async function updateDriverStatus(driverId: string, status: DbDriver['status']) {
  const { error } = await supabase
    .from('drivers')
    .update({ status })
    .eq('id', driverId)

  if (error) throw error
}

export async function incrementDriverDeliveries(driverId: string) {
  const { error } = await supabase.rpc('increment_driver_deliveries', {
    driver_id_param: driverId,
  })

  // If RPC doesn't exist, do it manually
  if (error) {
    const driver = await getDriver(driverId)
    await supabase
      .from('drivers')
      .update({
        total_deliveries: driver.total_deliveries + 1,
        today_deliveries: driver.today_deliveries + 1,
      })
      .eq('id', driverId)
  }
}

// ============ BUSINESSES ============

export async function getBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('name')

  if (error) throw error
  return data as DbBusiness[]
}

export async function getBusiness(businessId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (error) return null
  return data as DbBusiness
}

export async function getBusinessByUserId(userId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data as DbBusiness
}

// ============ ACTIVITY EVENTS ============

export async function getActivityEvents(limit = 20) {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as DbActivityEvent[]
}

export async function createActivityEvent(event: Omit<DbActivityEvent, 'id' | 'created_at'>) {
  const { error } = await supabase
    .from('activity_events')
    .insert(event)

  if (error) console.error('Activity event error:', error)
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
  // Upsert driver location
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
    // If upsert fails (no unique constraint), try insert
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

export async function getDeliveryDriverLocation(deliveryId: string) {
  const delivery = await getDelivery(deliveryId)
  if (!delivery?.driver_id) return null
  return getDriverLocation(delivery.driver_id)
}

// ============ STATS ============

export async function getDashboardStats() {
  const [
    { count: totalDeliveries },
    { count: activeDeliveries },
    { count: completedToday },
    { count: totalDrivers },
    { count: activeDrivers },
    { count: totalBusinesses },
  ] = await Promise.all([
    supabase.from('deliveries').select('*', { count: 'exact', head: true }),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).in('status', ['posted', 'claimed', 'in_transit']),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', new Date().toISOString().split('T')[0]),
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).in('status', ['available', 'on_delivery']),
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
  ])

  return {
    totalDeliveries: totalDeliveries || 0,
    activeDeliveries: activeDeliveries || 0,
    completedToday: completedToday || 0,
    totalDrivers: totalDrivers || 0,
    activeDrivers: activeDrivers || 0,
    totalBusinesses: totalBusinesses || 0,
  }
}
