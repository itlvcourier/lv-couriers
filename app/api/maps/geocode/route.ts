import { NextResponse } from 'next/server'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

/**
 * GET /api/maps/geocode
 * Server-side proxy for Google Geocoding API.
 * Converts an address string to lat/lng coordinates.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address || address.trim().length < 3) {
    return NextResponse.json({ error: 'Missing or invalid address' }, { status: 400 })
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 500 },
    )
  }

  try {
    // Add Calgary, AB, Canada as bias for better local results
    const biasedAddress = /calgary|edmonton|alberta|ab\b|canada/i.test(address)
      ? address
      : `${address}, Calgary, AB, Canada`

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
      return NextResponse.json({ lat: null, lng: null, formattedAddress: null })
    }

    const result = data.results[0]
    return NextResponse.json({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    })
  } catch (error) {
    console.error('[v0] Geocode error:', error)
    return NextResponse.json({ error: 'Failed to geocode address' }, { status: 500 })
  }
}
