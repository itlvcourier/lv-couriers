import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeAddress } from '@/lib/google-maps'

/**
 * POST /api/delivery/geocode
 * Fire-and-forget geocoding: looks up a delivery's pickup/dropoff addresses,
 * converts them to lat/lng via Nominatim, and updates the row.
 * Called after a delivery is created so the track page can show map pins.
 */
export async function POST(request: Request) {
  try {
    const { deliveryId } = await request.json()
    if (!deliveryId) {
      return NextResponse.json({ error: 'Missing deliveryId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch the delivery's addresses
    const { data: delivery, error: fetchErr } = await supabase
      .from('deliveries')
      .select('pickup_address, dropoff_address, pickup_lat, dropoff_lat')
      .eq('id', deliveryId)
      .single()

    if (fetchErr || !delivery) {
      console.error('[v0] Geocode: delivery not found', deliveryId)
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    // Skip if already geocoded
    if (delivery.pickup_lat && delivery.dropoff_lat) {
      return NextResponse.json({ ok: true, skipped: 'already geocoded' })
    }

    // Geocode the addresses using Google Maps API
    const [pickupResult, dropoffResult] = await Promise.all([
      delivery.pickup_address && !delivery.pickup_lat
        ? geocodeAddress(delivery.pickup_address)
        : null,
      delivery.dropoff_address && !delivery.dropoff_lat
        ? geocodeAddress(delivery.dropoff_address)
        : null,
    ])

    // Only update fields that actually got geocoded
    const updates: Record<string, number | null> = {}
    if (pickupResult) {
      updates.pickup_lat = pickupResult.lat
      updates.pickup_lng = pickupResult.lng
    }
    if (dropoffResult) {
      updates.dropoff_lat = dropoffResult.lat
      updates.dropoff_lng = dropoffResult.lng
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no new coords' })
    }

    // Persist coordinates
    const { error: updateErr } = await supabase
      .from('deliveries')
      .update(updates)
      .eq('id', deliveryId)

    if (updateErr) {
      console.error('[v0] Geocode update failed:', updateErr.message)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      geocoded: {
        pickup: !!pickupResult,
        dropoff: !!dropoffResult,
      },
    })
  } catch (err) {
    console.error('[v0] Geocode route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
