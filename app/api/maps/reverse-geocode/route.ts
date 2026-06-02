import { NextResponse } from 'next/server'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

/**
 * GET /api/maps/reverse-geocode
 * Server-side proxy for Google Reverse Geocoding API.
 * Converts lat/lng to a street name.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 500 },
    )
  }

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

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ street: null, full: null })
    }

    const result = data.results[0]
    // Extract just the street name from address components
    const route = result.address_components?.find((c: { types: string[] }) =>
      c.types.includes('route'),
    )

    return NextResponse.json({
      street: route?.long_name || result.formatted_address.split(',')[0],
      full: result.formatted_address,
    })
  } catch (error) {
    console.error('[v0] Reverse geocode error:', error)
    return NextResponse.json({ error: 'Failed to reverse geocode' }, { status: 500 })
  }
}
