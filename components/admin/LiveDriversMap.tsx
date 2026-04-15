'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  Battery, 
  Clock,
  ExternalLink
} from 'lucide-react'

interface DriverTooltip {
  driverId: string
  x: number
  y: number
}

export function LiveDriversMap() {
  const { drivers, driverGPS, deliveries } = useApp()
  const [selectedDriver, setSelectedDriver] = useState<DriverTooltip | null>(null)

  // Get driver info with GPS
  const activeDrivers = drivers
    .filter(d => d.inviteStatus === 'active')
    .map(driver => {
      const gps = driverGPS.find(g => g.driverId === driver.id)
      const activeDelivery = deliveries.find(
        d => d.driverId === driver.id && !['delivered', 'failed_permanent', 'cancelled', 'posted'].includes(d.status)
      )
      
      // Determine color based on status
      let color = 'gray' // available/off duty
      let statusLabel = 'Available'
      
      if (driver.status === 'off_duty') {
        color = 'gray'
        statusLabel = 'Off Duty'
      } else if (activeDelivery) {
        if (activeDelivery.status === 'en_route_pickup') {
          color = 'blue'
          statusLabel = 'At Pickup'
        } else if (activeDelivery.status === 'en_route_dropoff' || activeDelivery.status === 'picked_up') {
          color = 'orange'
          statusLabel = 'En Route'
        } else if (activeDelivery.status === 'delivered') {
          color = 'green'
          statusLabel = 'Delivering'
        }
      }
      
      return {
        ...driver,
        gps,
        activeDelivery,
        color,
        statusLabel,
      }
    })

  // Map position calculations (mock Calgary coordinates to SVG)
  const getDriverPosition = (driverId: string): { x: number; y: number } => {
    const gps = driverGPS.find(g => g.driverId === driverId)
    if (!gps) return { x: 200, y: 150 }
    
    // Map Calgary coordinates to SVG viewport
    // Calgary center: 51.0447, -114.0719
    const centerLat = 51.0447
    const centerLng = -114.0719
    const scale = 1000
    
    const x = 200 + (gps.lng - centerLng) * scale
    const y = 150 - (gps.lat - centerLat) * scale
    
    return { x: Math.max(40, Math.min(360, x)), y: Math.max(40, Math.min(260, y)) }
  }

  const handleDriverClick = (driverId: string, e: React.MouseEvent) => {
    const rect = (e.target as SVGElement).getBoundingClientRect()
    setSelectedDriver({
      driverId,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  const getColorClass = (color: string) => {
    switch (color) {
      case 'orange': return 'fill-orange-500'
      case 'blue': return 'fill-blue-500'
      case 'green': return 'fill-green-500'
      default: return 'fill-gray-500'
    }
  }

  const getColorBg = (color: string) => {
    switch (color) {
      case 'orange': return 'bg-orange-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const selectedDriverData = selectedDriver 
    ? activeDrivers.find(d => d.id === selectedDriver.driverId)
    : null

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Live Drivers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {/* Map */}
        <div className="relative rounded-lg overflow-hidden bg-muted/30 mb-4">
          <svg viewBox="0 0 400 300" className="w-full h-48 sm:h-64">
            {/* Background */}
            <rect width="400" height="300" fill="currentColor" className="text-muted/10" />
            
            {/* Calgary street grid */}
            <g stroke="currentColor" className="text-muted/20" strokeWidth="1">
              {/* Horizontal streets */}
              {[50, 100, 150, 200, 250].map(y => (
                <line key={`h-${y}`} x1="0" y1={y} x2="400" y2={y} />
              ))}
              {/* Vertical streets */}
              {[50, 100, 150, 200, 250, 300, 350].map(x => (
                <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="300" />
              ))}
              {/* Diagonal roads (Calgary's angled streets) */}
              <line x1="0" y1="0" x2="200" y2="300" strokeWidth="2" />
              <line x1="100" y1="0" x2="400" y2="250" strokeWidth="2" />
            </g>

            {/* Driver dots */}
            {activeDrivers.filter(d => d.gps).map(driver => {
              const pos = getDriverPosition(driver.id)
              const isEnRoute = driver.color === 'orange'
              
              return (
                <g 
                  key={driver.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => handleDriverClick(driver.id, e)}
                  className="cursor-pointer"
                >
                  {/* Pulse effect for en route */}
                  {isEnRoute && (
                    <circle 
                      r="18" 
                      className="fill-orange-500/20 animate-ping"
                    />
                  )}
                  {/* Driver dot */}
                  <circle 
                    r="12" 
                    className={`${getColorClass(driver.color)} opacity-30`}
                  />
                  <circle 
                    r="8" 
                    className={getColorClass(driver.color)}
                  />
                  {/* Initial */}
                  <text 
                    textAnchor="middle" 
                    dominantBaseline="central"
                    className="fill-white text-[8px] font-bold pointer-events-none"
                  >
                    {driver.name.split(' ').map(n => n[0]).join('')}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">En Route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">At Pickup</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Delivering</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-muted-foreground">Available</span>
          </div>
        </div>

        {/* Driver status table */}
        <div className="overflow-x-auto -mx-2 sm:-mx-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-2 px-2 font-medium">Name</th>
                <th className="pb-2 px-2 font-medium">Status</th>
                <th className="pb-2 px-2 font-medium hidden sm:table-cell">Current Job</th>
                <th className="pb-2 px-2 font-medium hidden sm:table-cell">Last Update</th>
                <th className="pb-2 px-2 font-medium">Battery</th>
              </tr>
            </thead>
            <tbody>
              {activeDrivers.map(driver => (
                <tr key={driver.id} className="border-b border-border/50">
                  <td className="py-2.5 px-2 font-medium text-foreground">{driver.name}</td>
                  <td className="py-2.5 px-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                      driver.color === 'orange' ? 'bg-orange-500/10 text-orange-400' :
                      driver.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                      driver.color === 'green' ? 'bg-green-500/10 text-green-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {driver.statusLabel}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">
                    {driver.activeDelivery ? (
                      <span className="truncate max-w-[120px] inline-block">
                        {driver.activeDelivery.businessName} #{driver.activeDelivery.id.slice(-3)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">
                    {driver.gps ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getRelativeTime(driver.gps.lastUpdate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {driver.gps ? (
                      <span className={`flex items-center gap-1 ${
                        driver.gps.battery < 20 ? 'text-red-400' :
                        driver.gps.battery < 50 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        <Battery className="w-3 h-3" />
                        {driver.gps.battery}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tooltip popover */}
        {selectedDriver && selectedDriverData && (
          <div 
            className="fixed z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px]"
            style={{ 
              left: selectedDriver.x - 100, 
              top: selectedDriver.y - 140,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground">{selectedDriverData.name}</span>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </div>
            {selectedDriverData.activeDelivery && (
              <p className="text-sm text-muted-foreground mb-1">
                {selectedDriverData.activeDelivery.businessName}
              </p>
            )}
            {selectedDriverData.gps && (
              <>
                <p className="text-xs text-muted-foreground">
                  Last update: {getRelativeTime(selectedDriverData.gps.lastUpdate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Battery: {selectedDriverData.gps.battery}%
                </p>
              </>
            )}
            {selectedDriverData.activeDelivery && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => {
                  // Would link to delivery detail
                  setSelectedDriver(null)
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Delivery
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000)
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)} hr ago`
}
