import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeDeliveryAddresses } from '@/lib/geocode'

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

    // Geocode the addresses
    const coords = await geocodeDeliveryAddresses(
      delivery.pickup_address,
      delivery.dropoff_address,
    )

    // Only update fields that actually got geocoded
    const updates: Record<string, number | null> = {}
    if (coords.pickup_lat !== null && !delivery.pickup_lat) {
      updates.pickup_lat = coords.pickup_lat
      updates.pickup_lng = coords.pickup_lng
    }
    if (coords.dropoff_lat !== null && !delivery.dropoff_lat) {
      updates.dropoff_lat = coords.dropoff_lat
      updates.dropoff_lng = coords.dropoff_lng
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
        pickup: coords.pickup_lat !== null,
        dropoff: coords.dropoff_lat !== null,
      },
    })
  } catch (err) {
    console.error('[v0] Geocode route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
