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

export type GeocodeConfidence = 'complete' | 'inferred' | 'unconfirmed' | 'manual'

export interface AddressValidationResult {
  confidence: GeocodeConfidence
  formattedAddress: string
  lat: number | null
  lng: number | null
  postalCode: string | null
  /** Human-readable issues, e.g. missing unit / unconfirmed components. */
  issues: string[]
  /** True when Google could not confirm the address to premise level. */
  hasUnconfirmedComponents: boolean
}

/**
 * Validate an address with the Google Address Validation API and map Google's
 * verdict into our four-level confidence scale:
 *  - complete    → premise-level, fully confirmed
 *  - inferred     → confirmed but Google inferred/added components
 *  - unconfirmed  → unconfirmed components or missing premise
 *  - manual       → API unavailable or hard failure (caller pins manually)
 */
export async function validateAddress(
  address: string,
): Promise<AddressValidationResult> {
  const fallback: AddressValidationResult = {
    confidence: 'manual',
    formattedAddress: address,
    lat: null,
    lng: null,
    postalCode: null,
    issues: ['Address validation unavailable — confirm location manually.'],
    hasUnconfirmedComponents: true,
  }
  if (!address || address.trim().length < 3) return fallback
  if (!API_KEY) {
    console.error('[v0] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured')
    return fallback
  }

  const biasedAddress = /calgary|edmonton|alberta|ab\b|canada/i.test(address)
    ? address
    : `${address}, Calgary, AB, Canada`

  try {
    const response = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: { regionCode: 'CA', addressLines: [biasedAddress] },
        }),
      },
    )
    const data = await response.json()
    const result = data?.result
    if (!result) {
      console.warn('[v0] validateAddress: no result', data?.error?.message)
      return fallback
    }

    const verdict = result.verdict ?? {}
    const geocode = result.geocode ?? {}
    const location = geocode.location ?? {}
    const components: Array<{ confirmationLevel?: string; componentType?: string }> =
      result.address?.addressComponents ?? []

    const issues: string[] = []
    const unconfirmed = components.filter(
      (c) =>
        c.confirmationLevel &&
        c.confirmationLevel !== 'CONFIRMED' &&
        c.confirmationLevel !== 'CONFIRMATION_LEVEL_UNSPECIFIED',
    )
    for (const c of unconfirmed) {
      issues.push(`Unconfirmed: ${c.componentType ?? 'component'}`)
    }
    if (verdict.hasUnconfirmedComponents) issues.push('Address has unconfirmed components.')
    if (verdict.hasInferredComponents) issues.push('Some components were inferred by Google.')
    if (result.address?.missingComponentTypes?.length) {
      issues.push(`Missing: ${result.address.missingComponentTypes.join(', ')}`)
    }

    let confidence: GeocodeConfidence
    const granularity = verdict.validationGranularity ?? verdict.geocodeGranularity
    if (verdict.addressComplete && !verdict.hasUnconfirmedComponents && !verdict.hasInferredComponents) {
      confidence = 'complete'
    } else if (
      (granularity === 'PREMISE' || granularity === 'SUB_PREMISE' || granularity === 'ROUTE') &&
      !verdict.hasUnconfirmedComponents
    ) {
      confidence = 'inferred'
    } else {
      confidence = 'unconfirmed'
    }

    const postalComponent = components.find((c) => c.componentType === 'postal_code') as
      | { componentName?: { text?: string } }
      | undefined

    return {
      confidence,
      formattedAddress: result.address?.formattedAddress ?? biasedAddress,
      lat: typeof location.latitude === 'number' ? location.latitude : null,
      lng: typeof location.longitude === 'number' ? location.longitude : null,
      postalCode: postalComponent?.componentName?.text ?? null,
      issues,
      hasUnconfirmedComponents: Boolean(verdict.hasUnconfirmedComponents),
    }
  } catch (error) {
    console.error('[v0] validateAddress error:', error)
    return fallback
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
