/**
 * Google Maps utilities for LV Courier
 * - Geocoding (address → coordinates)
 * - Reverse Geocoding (coordinates → address)
 * - Distance Matrix (ETA calculations)
 * - Directions (route polylines)
 */

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export interface LatLng {
  lat: number
  lng: number
}

export interface GeocodedResult {
  lat: number
  lng: number
  formattedAddress: string
  placeId?: string
}

export interface DistanceResult {
  distanceMeters: number
  distanceText: string
  durationSeconds: number
  durationText: string
}

export interface DirectionsResult {
  polyline: string // Encoded polyline for the route
  distance: DistanceResult
  steps?: Array<{
    instruction: string
    distance: string
    duration: string
  }>
}

/**
 * Geocode an address string to lat/lng coordinates using Google Maps Geocoding API.
 * Handles informal Canadian addresses much better than Nominatim.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodedResult | null> {
  if (!address || address.trim().length < 3) return null
  if (!API_KEY) {
    console.error('[v0] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured')
    return null
  }

  // Add Calgary, AB, Canada as bias for better local results
  const biasedAddress = /calgary|edmonton|alberta|ab\b|canada/i.test(address)
    ? address
    : `${address}, Calgary, AB, Canada`

  try {
    const params = new URLSearchParams({
      address: biasedAddress,
      key: API_KEY,
      region: 'ca', // Bias toward Canada
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    )
    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.warn('[v0] Geocode failed:', data.status, address)
      return null
    }

    const result = data.results[0]
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    }
  } catch (error) {
    console.error('[v0] Geocode error:', error)
    return null
  }
}

/**
 * Reverse geocode coordinates to a human-readable address.
 * Useful for showing "Driver is on 9th Ave SW".
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ street: string; full: string } | null> {
  if (!API_KEY) return null

  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: API_KEY,
      result_type: 'street_address|route',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    )
    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]) return null

    const result = data.results[0]
    // Extract just the street name from address components
    const route = result.address_components?.find((c: { types: string[] }) =>
      c.types.includes('route'),
    )

    return {
      street: route?.long_name || result.formatted_address.split(',')[0],
      full: result.formatted_address,
    }
  } catch (error) {
    console.error('[v0] Reverse geocode error:', error)
    return null
  }
}

/**
 * Calculate distance and ETA between two points using Distance Matrix API.
 * Returns driving distance and duration.
 */
export async function getDistanceAndETA(
  origin: LatLng,
  destination: LatLng,
): Promise<DistanceResult | null> {
  if (!API_KEY) return null

  try {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      key: API_KEY,
      mode: 'driving',
      units: 'metric',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
    )
    const data = await response.json()

    if (data.status !== 'OK') return null

    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status !== 'OK') return null

    return {
      distanceMeters: element.distance.value,
      distanceText: element.distance.text,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
    }
  } catch (error) {
    console.error('[v0] Distance matrix error:', error)
    return null
  }
}

/**
 * Get driving directions between two points, including the encoded polyline
 * for drawing the route on a map.
 */
export async function getDirections(
  origin: LatLng,
  destination: LatLng,
): Promise<DirectionsResult | null> {
  if (!API_KEY) return null

  try {
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: API_KEY,
      mode: 'driving',
      units: 'metric',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
    )
    const data = await response.json()

    if (data.status !== 'OK' || !data.routes?.[0]) return null

    const route = data.routes[0]
    const leg = route.legs[0]

    return {
      polyline: route.overview_polyline.points,
      distance: {
        distanceMeters: leg.distance.value,
        distanceText: leg.distance.text,
        durationSeconds: leg.duration.value,
        durationText: leg.duration.text,
      },
      steps: leg.steps?.map((step: { html_instructions: string; distance: { text: string }; duration: { text: string } }) => ({
        instruction: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
      })),
    }
  } catch (error) {
    console.error('[v0] Directions error:', error)
    return null
  }
}

/**
 * Decode a Google Maps encoded polyline to an array of LatLng points.
 * Used to draw route lines on maps.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return points
}
