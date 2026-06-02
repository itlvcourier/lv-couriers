import { NextResponse } from 'next/server'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

/**
 * GET /api/maps/directions
 * Server-side proxy for Google Directions API (avoids CORS).
 * Returns route polyline and ETA between origin and destination.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const originLat = searchParams.get('originLat')
  const originLng = searchParams.get('originLng')
  const destLat = searchParams.get('destLat')
  const destLng = searchParams.get('destLng')

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing origin or destination coordinates' },
      { status: 400 },
    )
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 500 },
    )
  }

  try {
    const params = new URLSearchParams({
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      key: API_KEY,
      mode: 'driving',
      units: 'metric',
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
    )
    const data = await response.json()

    if (data.status !== 'OK' || !data.routes?.[0]) {
      return NextResponse.json({ error: data.status }, { status: 400 })
    }

    const route = data.routes[0]
    const leg = route.legs[0]

    return NextResponse.json({
      polyline: route.overview_polyline.points,
      distance: {
        meters: leg.distance.value,
        text: leg.distance.text,
      },
      duration: {
        seconds: leg.duration.value,
        text: leg.duration.text,
      },
    })
  } catch (error) {
    console.error('[v0] Directions API error:', error)
    return NextResponse.json({ error: 'Failed to fetch directions' }, { status: 500 })
  }
}
