// Route optimization utilities

export interface Coordinate {
  lat: number
  lng: number
}

export interface DeliveryStop {
  id: string
  address: string
  contact: string
  lat: number
  lng: number
  type: 'pickup' | 'dropoff'
}

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(point1: Coordinate, point2: Coordinate): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(point2.lat - point1.lat)
  const dLon = toRad(point2.lng - point1.lng)
  const lat1 = toRad(point1.lat)
  const lat2 = toRad(point2.lat)

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Format distance for display
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`
  }
  return `${miles.toFixed(1)} mi`
}

// Estimate travel time based on distance (assuming average 25 mph in city)
export function estimateTravelTime(miles: number): number {
  const avgSpeedMph = 25
  return Math.ceil((miles / avgSpeedMph) * 60) // minutes
}

// Format travel time for display
export function formatTravelTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

// Calculate total route distance
export function calculateRouteDistance(stops: DeliveryStop[]): number {
  if (stops.length < 2) return 0
  
  let totalDistance = 0
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += calculateDistance(
      { lat: stops[i].lat, lng: stops[i].lng },
      { lat: stops[i + 1].lat, lng: stops[i + 1].lng }
    )
  }
  return totalDistance
}

// Simple nearest-neighbor route optimization
// Returns stops in optimized order starting from pickup
export function optimizeRoute(stops: DeliveryStop[]): DeliveryStop[] {
  if (stops.length <= 2) return stops

  // Separate pickup and dropoff stops
  const pickups = stops.filter(s => s.type === 'pickup')
  const dropoffs = stops.filter(s => s.type === 'dropoff')

  // For now, do pickups first, then optimize dropoff order
  if (pickups.length === 0 || dropoffs.length === 0) {
    return nearestNeighborSort(stops)
  }

  // Start with pickup(s)
  const optimizedPickups = nearestNeighborSort(pickups)
  
  // Then optimize dropoffs starting from last pickup
  const lastPickup = optimizedPickups[optimizedPickups.length - 1]
  const optimizedDropoffs = nearestNeighborSortFrom(dropoffs, lastPickup)

  return [...optimizedPickups, ...optimizedDropoffs]
}

// Nearest neighbor algorithm for TSP approximation
function nearestNeighborSort(stops: DeliveryStop[]): DeliveryStop[] {
  if (stops.length <= 1) return stops

  const result: DeliveryStop[] = [stops[0]]
  const remaining = stops.slice(1)

  while (remaining.length > 0) {
    const current = result[result.length - 1]
    let nearestIndex = 0
    let nearestDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        { lat: current.lat, lng: current.lng },
        { lat: remaining[i].lat, lng: remaining[i].lng }
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }

    result.push(remaining[nearestIndex])
    remaining.splice(nearestIndex, 1)
  }

  return result
}

// Nearest neighbor starting from a specific point
function nearestNeighborSortFrom(stops: DeliveryStop[], startPoint: DeliveryStop): DeliveryStop[] {
  if (stops.length === 0) return []
  if (stops.length === 1) return stops

  const remaining = [...stops]
  const result: DeliveryStop[] = []
  let current: Coordinate = { lat: startPoint.lat, lng: startPoint.lng }

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        current,
        { lat: remaining[i].lat, lng: remaining[i].lng }
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }

    const nearest = remaining[nearestIndex]
    result.push(nearest)
    current = { lat: nearest.lat, lng: nearest.lng }
    remaining.splice(nearestIndex, 1)
  }

  return result
}

// Group deliveries by proximity for bundling
export function groupDeliveriesByProximity(
  stops: DeliveryStop[],
  maxDistanceMiles: number = 2
): DeliveryStop[][] {
  if (stops.length === 0) return []
  if (stops.length === 1) return [stops]

  const groups: DeliveryStop[][] = []
  const assigned = new Set<string>()

  for (const stop of stops) {
    if (assigned.has(stop.id)) continue

    const group: DeliveryStop[] = [stop]
    assigned.add(stop.id)

    for (const other of stops) {
      if (assigned.has(other.id)) continue
      
      const distance = calculateDistance(
        { lat: stop.lat, lng: stop.lng },
        { lat: other.lat, lng: other.lng }
      )
      
      if (distance <= maxDistanceMiles) {
        group.push(other)
        assigned.add(other.id)
      }
    }

    groups.push(group)
  }

  return groups
}

// Calculate bounding box for a set of coordinates
export function getBoundingBox(coordinates: Coordinate[]): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
  center: Coordinate
} {
  if (coordinates.length === 0) {
    // Default to Las Vegas
    return {
      minLat: 36.1,
      maxLat: 36.2,
      minLng: -115.2,
      maxLng: -115.1,
      center: { lat: 36.1699, lng: -115.1398 }
    }
  }

  const lats = coordinates.map(c => c.lat)
  const lngs = coordinates.map(c => c.lng)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    center: {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    }
  }
}
