import type { Delivery } from '@/lib/types'
import type { Hub } from '@/lib/hubs'

export type LatLng = { lat: number; lng: number }

export type RouteStop = {
  deliveryId: string
  kind: 'pickup' | 'dropoff' | 'hub'
  label: string
  address: string
  point: LatLng | null
}

const PRE_PICKUP = new Set(['claimed', 'en_route_pickup'])

function toPoint(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (lat == null || lng == null) return null
  const a = Number(lat)
  const b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null
}

/** Remaining stops for one job, based on its status and cross-dock leg. */
export function remainingStops(d: Delivery, hub: Hub | null): RouteStop[] {
  const pickup: RouteStop = {
    deliveryId: d.id,
    kind: 'pickup',
    label: `Pickup · ${d.businessName}`,
    address: d.pickupAddress,
    point: toPoint(d.pickupLat, d.pickupLng),
  }
  const dropoff: RouteStop = {
    deliveryId: d.id,
    kind: 'dropoff',
    label: `Drop-off · ${d.recipientName || d.dropoffArea || 'Recipient'}`,
    address: d.dropoffAddress,
    point: toPoint(d.dropoffLat, d.dropoffLng),
  }
  const beforePickup = PRE_PICKUP.has(d.status)

  if (d.routingMode === 'cross_dock') {
    const isLastMile = (d.legStatus ?? 'created') === 'out_for_delivery'
    if (isLastMile) return [dropoff]
    const hubStop: RouteStop | null = hub?.address
      ? { deliveryId: d.id, kind: 'hub', label: `Hub · ${hub.name}`, address: hub.address, point: toPoint(hub.lat, hub.lng) }
      : null
    const tail = hubStop ? [hubStop] : []
    return beforePickup ? [pickup, ...tail] : tail
  }

  return beforePickup ? [pickup, dropoff] : [dropoff]
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Straight-line length of a stop sequence; stops without coordinates are skipped. */
export function routeLengthKm(stops: RouteStop[], origin: LatLng | null): number {
  let total = 0
  let prev = origin
  for (const s of stops) {
    if (!s.point) continue
    if (prev) total += haversineKm(prev, s.point)
    prev = s.point
  }
  return total
}

type Job = { id: string; stops: RouteStop[] }

function sequenceCost(seq: Job[], origin: LatLng | null): number {
  return routeLengthKm(seq.flatMap((j) => j.stops), origin)
}

/**
 * Orders jobs to minimise total driving distance while keeping each job's own
 * stops in order (pickup before drop-off). Nearest-neighbour seed + 2-opt.
 */
function optimizeGroup(jobs: Job[], origin: LatLng | null): Job[] {
  if (jobs.length < 2) return jobs
  const remaining = [...jobs]
  const seq: Job[] = []
  let cursor = origin ?? remaining[0].stops.find((s) => s.point)?.point ?? null
  while (remaining.length) {
    let best = 0
    let bestDist = Infinity
    remaining.forEach((j, i) => {
      const first = j.stops.find((s) => s.point)?.point
      const dist = cursor && first ? haversineKm(cursor, first) : 0
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    const [next] = remaining.splice(best, 1)
    seq.push(next)
    cursor = [...next.stops].reverse().find((s) => s.point)?.point ?? cursor
  }

  let improved = true
  let bestCost = sequenceCost(seq, origin)
  let guard = 0
  while (improved && guard++ < 50) {
    improved = false
    for (let i = 0; i < seq.length - 1; i++) {
      for (let k = i + 1; k < seq.length; k++) {
        const candidate = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)]
        const cost = sequenceCost(candidate, origin)
        if (cost + 0.01 < bestCost) {
          seq.splice(0, seq.length, ...candidate)
          bestCost = cost
          improved = true
        }
      }
    }
  }
  return seq
}

/**
 * Returns delivery ids in the suggested order. Rush jobs always go first;
 * jobs we can't place on a map (no coordinates) keep their order at the end.
 */
export function optimizeJobOrder(
  deliveries: Delivery[],
  hubFor: (d: Delivery) => Hub | null,
  origin: LatLng | null,
): string[] {
  const jobs = deliveries.map((d) => ({ d, job: { id: d.id, stops: remainingStops(d, hubFor(d)) } }))
  const mappable = (j: Job) => j.stops.length > 0 && j.stops.every((s) => s.point)
  const rush = jobs.filter((x) => (x.d.isUrgent || x.d.isRush) && mappable(x.job)).map((x) => x.job)
  const normal = jobs.filter((x) => !(x.d.isUrgent || x.d.isRush) && mappable(x.job)).map((x) => x.job)
  const unmapped = jobs.filter((x) => !mappable(x.job)).map((x) => x.job)

  const rushSeq = optimizeGroup(rush, origin)
  const afterRush = [...rushSeq.flatMap((j) => j.stops)].reverse().find((s) => s.point)?.point ?? origin
  const normalSeq = optimizeGroup(normal, afterRush)
  return [...rushSeq, ...normalSeq, ...unmapped].map((j) => j.id)
}

/** Flattens jobs (already in driver order) into a stop list, merging back-to-back duplicates. */
export function buildStopList(
  ordered: Delivery[],
  hubFor: (d: Delivery) => Hub | null,
): RouteStop[] {
  const out: RouteStop[] = []
  for (const d of ordered) {
    for (const s of remainingStops(d, hubFor(d))) {
      const prev = out[out.length - 1]
      if (prev && prev.address.trim().toLowerCase() === s.address.trim().toLowerCase()) continue
      out.push(s)
    }
  }
  return out
}

/** Google Maps accepts up to 9 waypoints per link, so long routes are split into parts. */
export const GOOGLE_STOPS_PER_LINK = 10

export function googleMapsRouteLinks(stops: RouteStop[], origin: LatLng | null): string[] {
  if (stops.length === 0) return []
  const links: string[] = []
  let start: string | null = origin ? `${origin.lat},${origin.lng}` : null
  for (let i = 0; i < stops.length; i += GOOGLE_STOPS_PER_LINK) {
    const chunk = stops.slice(i, i + GOOGLE_STOPS_PER_LINK)
    const destination = chunk[chunk.length - 1].address
    const waypoints = chunk.slice(0, -1).map((s) => s.address)
    const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' })
    if (start) params.set('origin', start)
    if (waypoints.length) params.set('waypoints', waypoints.join('|'))
    links.push(`https://www.google.com/maps/dir/?${params.toString()}`)
    start = destination
  }
  return links
}

export function wazeLink(stop: RouteStop): string {
  return stop.point
    ? `https://waze.com/ul?ll=${stop.point.lat},${stop.point.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(stop.address)}&navigate=yes`
}

export function appleMapsLink(stop: RouteStop): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(stop.address)}&dirflg=d`
}
