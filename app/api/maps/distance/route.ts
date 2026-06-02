import { NextResponse } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

/**
 * Calculate driving distance between two points using Google Distance Matrix API.
 * Returns distance in kilometers and duration in minutes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const originLat = searchParams.get('originLat')
  const originLng = searchParams.get('originLng')
  const destLat = searchParams.get('destLat')
  const destLng = searchParams.get('destLng')

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing required parameters: originLat, originLng, destLat, destLng' },
      { status: 400 }
    )
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 500 }
    )
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', `${originLat},${originLng}`)
    url.searchParams.set('destinations', `${destLat},${destLng}`)
    url.searchParams.set('units', 'metric')
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('[v0] Distance Matrix API error:', data.status, data.error_message)
      return NextResponse.json(
        { error: `Distance Matrix API error: ${data.status}` },
        { status: 500 }
      )
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') {
      return NextResponse.json(
        { error: 'Could not calculate distance between locations' },
        { status: 400 }
      )
    }

    // distance.value is in meters, convert to km
    const distanceKm = Math.round((element.distance.value / 1000) * 10) / 10
    // duration.value is in seconds, convert to minutes
    const durationMin = Math.round(element.duration.value / 60)

    return NextResponse.json({
      distanceKm,
      durationMin,
      distanceText: element.distance.text,
      durationText: element.duration.text,
    })
  } catch (error) {
    console.error('[v0] Distance calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate distance' },
      { status: 500 }
    )
  }
}
