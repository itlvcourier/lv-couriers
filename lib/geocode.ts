/**
 * Geocoding utility using Nominatim (OpenStreetMap) — free, no API key required.
 * Rate-limited to 1 request/second per their terms of service.
 */

export interface GeocodedAddress {
  lat: number
  lng: number
  displayName: string
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

/**
 * Geocode an address string to lat/lng coordinates.
 * Returns null if the address cannot be geocoded.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodedAddress | null> {
  if (!address || address.trim().length < 5) return null

  // Normalize: strip unit/suite prefixes and append default city if missing.
  let normalizedAddress = address
    .trim()
    // Remove leading unit numbers like "14, " or "Unit 14, " or "#14, "
    .replace(/^(unit\s*|suite\s*|#)?[\d\w]+,\s*/i, '')
    // Remove middle unit references like ", Unit 14" or ", #14"
    .replace(/,\s*(unit|suite|#)\s*[\d\w]+/gi, '')

  const hasCity =
    /calgary|edmonton|alberta|ab\b|canada/i.test(normalizedAddress)
  if (!hasCity) {
    normalizedAddress = `${normalizedAddress}, Calgary, AB, Canada`
  }

  try {
    const params = new URLSearchParams({
      q: normalizedAddress,
      format: 'json',
      limit: '1',
      addressdetails: '0',
    })

    const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: {
        // Nominatim requires a User-Agent identifying the app
        'User-Agent': 'LVCourier/1.0 (delivery tracking)',
      },
    })

    if (!res.ok) {
      console.error('[v0] Nominatim request failed:', res.status)
      return null
    }

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    const result = data[0]
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    }
  } catch (err) {
    console.error('[v0] Geocoding error:', err)
    return null
  }
}

/**
 * Geocode both pickup and dropoff addresses for a delivery.
 * Returns an object with the coordinates (null fields if geocoding failed).
 */
export async function geocodeDeliveryAddresses(
  pickupAddress?: string | null,
  dropoffAddress?: string | null,
): Promise<{
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_lat: number | null
  dropoff_lng: number | null
}> {
  // Run both geocodes in parallel
  const [pickup, dropoff] = await Promise.all([
    pickupAddress ? geocodeAddress(pickupAddress) : null,
    dropoffAddress ? geocodeAddress(dropoffAddress) : null,
  ])

  return {
    pickup_lat: pickup?.lat ?? null,
    pickup_lng: pickup?.lng ?? null,
    dropoff_lat: dropoff?.lat ?? null,
    dropoff_lng: dropoff?.lng ?? null,
  }
}
