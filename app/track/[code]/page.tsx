'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Phone, 
  MapPin, 
  Check, 
  X, 
  Clock,
  Truck,
  Package,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock delivery data based on tracking code
const mockDeliveryData: Record<string, {
  driverName: string
  businessName: string
  dropoffAddress: string
  estimatedArrival: string
}> = {
  'LVC-005-TH': {
    driverName: 'Tariq',
    businessName: 'FreshMart Grocery',
    dropoffAddress: '2525 36 St NE, Calgary',
    estimatedArrival: '12 min',
  },
  'LVC-006-JC': {
    driverName: 'Jenna',
    businessName: 'HomeGoods Plus',
    dropoffAddress: '8180 11 St SE, Calgary',
    estimatedArrival: '8 min',
  },
  'LVC-007-MR': {
    driverName: 'Marcus',
    businessName: 'FreshMart Grocery',
    dropoffAddress: '4820 Northland Dr NW, Calgary',
    estimatedArrival: '0 min',
  },
  'LVC-008-JC': {
    driverName: 'Jenna',
    businessName: 'MedSupply Co',
    dropoffAddress: '130 Crowfoot Crescent NW, Calgary',
    estimatedArrival: '0 min',
  },
}

type TrackingStatus = 'claimed' | 'picked_up' | 'en_route_dropoff' | 'delivered' | 'failed'

interface StatusStep {
  id: string
  label: string
  status: 'complete' | 'current' | 'upcoming'
  timestamp?: string
}

export default function TrackingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const code = params.code as string
  const statusOverride = searchParams.get('status') as TrackingStatus | null
  const expired = searchParams.get('expired')

  const [animateDriver, setAnimateDriver] = useState(false)

  const deliveryInfo = mockDeliveryData[code]

  // Determine effective status
  const getEffectiveStatus = (): TrackingStatus | null => {
    if (expired === 'true' || !deliveryInfo) return null
    if (statusOverride) return statusOverride
    // Default based on tracking code
    if (code === 'LVC-007-MR' || code === 'LVC-008-JC') return 'delivered'
    if (code === 'LVC-006-JC') return 'en_route_dropoff'
    if (code === 'LVC-005-TH') return 'picked_up'
    return 'claimed'
  }

  const status = getEffectiveStatus()

  // Animate driver dot when en route
  useEffect(() => {
    if (status === 'en_route_dropoff' || status === 'picked_up') {
      setAnimateDriver(true)
    }
  }, [status])

  // Build status steps
  const getStatusSteps = (): StatusStep[] => {
    const steps: StatusStep[] = [
      { id: 'placed', label: 'Order placed', status: 'upcoming' },
      { id: 'assigned', label: 'Driver assigned', status: 'upcoming' },
      { id: 'picked_up', label: 'Picked up', status: 'upcoming' },
      { id: 'on_the_way', label: 'On the way', status: 'upcoming' },
      { id: 'delivered', label: 'Delivered', status: 'upcoming' },
    ]

    if (!status) return steps

    const statusOrder = ['claimed', 'picked_up', 'en_route_dropoff', 'delivered']
    const currentIndex = statusOrder.indexOf(status)

    // Order placed is always complete if we have any status
    steps[0].status = 'complete'
    steps[0].timestamp = '10:15 AM'

    // Driver assigned
    if (currentIndex >= 0) {
      steps[1].status = status === 'claimed' ? 'current' : 'complete'
      steps[1].timestamp = status !== 'claimed' ? '10:18 AM' : undefined
    }

    // Picked up
    if (currentIndex >= 1) {
      steps[2].status = status === 'picked_up' ? 'current' : 'complete'
      steps[2].timestamp = currentIndex > 1 ? '10:32 AM' : undefined
    }

    // On the way
    if (currentIndex >= 2) {
      steps[3].status = status === 'en_route_dropoff' ? 'current' : 'complete'
      steps[3].timestamp = currentIndex > 2 ? '10:35 AM' : undefined
    }

    // Delivered
    if (currentIndex >= 3 && status === 'delivered') {
      steps[4].status = 'complete'
      steps[4].timestamp = '2:47 PM'
    }

    return steps
  }

  // Expired or invalid tracking code
  if (!status || expired === 'true') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TrackingHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">This tracking link has expired</h2>
            <p className="text-muted-foreground mb-6">
              Deliveries are tracked for 24 hours after completion.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact LV Courier: <a href="tel:5875759699" className="text-primary font-medium">587-575-9699</a>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  // Failed delivery
  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TrackingHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Delivery attempted</h2>
            <p className="text-muted-foreground mb-6">
              We were unable to complete your delivery.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact us: <a href="tel:5875759699" className="text-primary font-medium">587-575-9699</a>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  const steps = getStatusSteps()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TrackingHeader />
      
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Map Section */}
        <div className="mb-6">
          {status === 'delivered' ? (
            // Delivered - show checkmark
            <Card className="h-[300px] md:h-[400px] flex items-center justify-center bg-gradient-to-br from-green-500/10 to-emerald-500/10">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-green-500 mb-2">Delivered!</h3>
                <p className="text-muted-foreground">at 2:47 PM</p>
              </div>
            </Card>
          ) : (
            // Show map
            <Card className="h-[300px] md:h-[400px] overflow-hidden relative bg-card">
              {/* Mock Calgary street grid */}
              <svg className="w-full h-full" viewBox="0 0 400 300">
                {/* Background */}
                <rect width="400" height="300" fill="currentColor" className="text-muted/10" />
                
                {/* Street grid */}
                <g stroke="currentColor" className="text-muted/30" strokeWidth="1">
                  {/* Horizontal streets */}
                  {[50, 100, 150, 200, 250].map(y => (
                    <line key={`h-${y}`} x1="0" y1={y} x2="400" y2={y} />
                  ))}
                  {/* Vertical streets */}
                  {[50, 100, 150, 200, 250, 300, 350].map(x => (
                    <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="300" />
                  ))}
                  {/* Diagonal (representing real Calgary roads) */}
                  <line x1="0" y1="0" x2="200" y2="300" strokeWidth="2" />
                  <line x1="100" y1="0" x2="400" y2="250" strokeWidth="2" />
                </g>

                {/* Destination pin */}
                <g transform="translate(300, 220)">
                  <circle r="12" fill="currentColor" className="text-primary/20" />
                  <circle r="6" fill="currentColor" className="text-primary" />
                </g>

                {/* Driver dot */}
                <g 
                  transform={animateDriver ? undefined : "translate(120, 100)"}
                  className={animateDriver ? "animate-driver-move" : ""}
                >
                  <circle r="16" fill="currentColor" className="text-primary/30 animate-ping" />
                  <circle r="10" fill="currentColor" className="text-primary" />
                  <Truck className="w-4 h-4 text-primary-foreground" style={{ transform: 'translate(-8px, -8px)' }} />
                </g>
              </svg>

              {/* Location updating text */}
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <p className="text-xs text-muted-foreground bg-card/80 backdrop-blur-sm rounded px-2 py-1 inline-block">
                  Location updating...
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Status Timeline */}
        <Card className="p-4 mb-6">
          <div className="space-y-0">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3 pb-4 last:pb-0">
                {/* Status indicator */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    step.status === 'complete' && "bg-primary text-primary-foreground",
                    step.status === 'current' && "bg-primary/20 border-2 border-primary",
                    step.status === 'upcoming' && "bg-muted border-2 border-muted-foreground/30"
                  )}>
                    {step.status === 'complete' ? (
                      <Check className="w-4 h-4" />
                    ) : step.status === 'current' ? (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                    )}
                  </div>
                  {/* Connecting line */}
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "w-0.5 h-8 mt-1",
                      step.status === 'complete' ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 pt-1">
                  <p className={cn(
                    "font-medium",
                    step.status === 'upcoming' && "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  {step.status === 'current' && (
                    <p className="text-sm text-primary">In progress</p>
                  )}
                  {step.timestamp && (
                    <p className="text-sm text-muted-foreground">{step.timestamp}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Driver strip - only show if not delivered */}
        {status !== 'delivered' && deliveryInfo && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Your driver: {deliveryInfo.driverName}</p>
                  <p className="text-sm text-muted-foreground">
                    Estimated arrival: {deliveryInfo.estimatedArrival}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-muted-foreground mb-2">Questions?</p>
          <a href="tel:5875759699" className="inline-flex items-center gap-2 text-primary font-medium">
            <Phone className="w-4 h-4" />
            Call 587-575-9699
          </a>
        </div>
      </main>
    </div>
  )
}

function TrackingHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-primary">LV</span>
          <span className="text-xl font-bold">COURIER</span>
        </div>
        {/* Phone */}
        <a href="tel:5875759699" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <Phone className="w-4 h-4" />
          587-575-9699
        </a>
      </div>
    </header>
  )
}
