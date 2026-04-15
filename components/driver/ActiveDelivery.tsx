'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PickupVerification } from './PickupVerification'
import { DeliveryCompletion } from './DeliveryCompletion'
import { toast } from 'sonner'
import { 
  Package, 
  MapPin, 
  Zap, 
  ExternalLink,
  CheckCircle,
  Circle,
  AlertTriangle,
  X,
} from 'lucide-react'
import type { Delivery, DeliveryStatus, FailReason } from '@/lib/types'

const STATUS_STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: 'claimed', label: 'Claimed' },
  { status: 'en_route_pickup', label: 'En Route to Pickup' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'en_route_dropoff', label: 'En Route to Drop-off' },
  { status: 'delivered', label: 'Delivered' },
]

const FAIL_REASONS: FailReason[] = [
  'recipient_unavailable',
  'wrong_address',
  'refused',
  'damaged',
  'other',
]

const FAIL_REASON_LABELS: Record<FailReason, string> = {
  recipient_unavailable: 'Recipient unavailable',
  wrong_address: 'Wrong address',
  refused: 'Delivery refused',
  damaged: 'Package damaged',
  other: 'Other reason',
}

function StatusStepper({ currentStatus }: { currentStatus: DeliveryStatus }) {
  const currentIndex = STATUS_STEPS.findIndex(s => s.status === currentStatus)
  
  return (
    <div className="space-y-2">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex
        const isCurrent = idx === currentIndex
        
        return (
          <div key={step.status} className="flex items-center gap-3">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center shrink-0
              ${isCompleted ? 'bg-[var(--accent-green)]' : isCurrent ? 'bg-[var(--accent-orange)] animate-pulse' : 'bg-[var(--bg-card-2)]'}
            `}>
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : (
                <Circle className={`w-3 h-3 ${isCurrent ? 'text-white' : 'text-muted-foreground'}`} />
              )}
            </div>
            <span className={`text-sm ${isCurrent ? 'text-[var(--accent-orange)] font-medium' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ActiveJobCard({ delivery }: { delivery: Delivery }) {
  const [showVerification, setShowVerification] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [showFailSheet, setShowFailSheet] = useState(false)
  const [failReason, setFailReason] = useState<FailReason | ''>('')
  const { advanceStatus, failDelivery } = useApp()

  const openInMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank')
  }

  const handleAction = () => {
    switch (delivery.status) {
      case 'claimed':
        advanceStatus(delivery.id)
        toast.success('Status updated - En route to pickup')
        break
      case 'en_route_pickup':
        setShowVerification(true)
        break
      case 'picked_up':
        advanceStatus(delivery.id)
        toast.success('Status updated - En route to drop-off')
        break
      case 'en_route_dropoff':
        setShowCompletion(true)
        break
    }
  }

  const handleFail = () => {
    if (failReason) {
      failDelivery(delivery.id, failReason)
      setShowFailSheet(false)
      setFailReason('')
      toast.error('Delivery marked as failed')
    }
  }

  const getActionButton = () => {
    switch (delivery.status) {
      case 'claimed':
        return { label: 'Start Pickup Run', color: 'bg-[var(--accent-blue)]' }
      case 'en_route_pickup':
        return { label: "I'm Here — Verify Pickup", color: 'bg-[var(--accent-orange)]' }
      case 'picked_up':
        return { label: 'Start Delivery Run', color: 'bg-[var(--accent-blue)]' }
      case 'en_route_dropoff':
        return { label: 'Mark as Delivered', color: 'bg-[var(--accent-green)]' }
      default:
        return null
    }
  }

  const actionButton = getActionButton()

  return (
    <>
      <div className="space-y-4">
        {/* Job Overview */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-foreground">{delivery.businessName}</h3>
              {delivery.isUrgent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                  <Zap className="w-3 h-3" />
                  Urgent
                </span>
              )}
            </div>
            
            {/* Manifest */}
            <div className="flex flex-wrap gap-2">
              {delivery.manifest.map((item, idx) => (
                <span 
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-card-2)] text-xs text-muted-foreground"
                >
                  {item.type === 'rush' ? <Zap className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                  {item.type === 'big_package' ? `Big x${item.postedQty}` : item.type === 'small_package' ? 'Small' : item.type === 'rush' ? 'Rush' : 'OOT'}
                </span>
              ))}
            </div>

            {/* Tracking code if available */}
            {delivery.trackingCode && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                <p className="text-xs text-muted-foreground">Tracking Code</p>
                <p className="text-sm font-mono text-foreground">{delivery.trackingCode}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pickup Address */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--accent-blue)]" /> Pickup
                </p>
                <p className="text-sm text-foreground">{delivery.pickupAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInMaps(delivery.pickupAddress)}
                className="shrink-0 gap-1 border-[var(--border-color)] tap-target"
              >
                <ExternalLink className="w-3 h-3" />
                Maps
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dropoff Address */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--accent-green)]" /> Drop-off
                </p>
                <p className="text-sm text-foreground">{delivery.dropoffAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInMaps(delivery.dropoffAddress)}
                className="shrink-0 gap-1 border-[var(--border-color)] tap-target"
              >
                <ExternalLink className="w-3 h-3" />
                Maps
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Stepper */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-foreground mb-4">Delivery Progress</h4>
            <StatusStepper currentStatus={delivery.status} />
          </CardContent>
        </Card>

        {/* Action Button */}
        {actionButton && (
          <Button
            onClick={handleAction}
            className={`w-full h-12 rounded-xl tap-target text-white font-medium ${actionButton.color} hover:opacity-90`}
          >
            {actionButton.label}
          </Button>
        )}

        {/* Cannot Complete link */}
        {delivery.status === 'en_route_dropoff' && (
          <button
            onClick={() => setShowFailSheet(true)}
            className="w-full text-center text-sm text-[var(--accent-red)] hover:underline"
          >
            Cannot Complete Delivery
          </button>
        )}
      </div>

      {/* Pickup Verification Modal */}
      {showVerification && (
        <PickupVerification
          delivery={delivery}
          onClose={() => setShowVerification(false)}
        />
      )}

      {/* Delivery Completion Modal */}
      {showCompletion && (
        <DeliveryCompletion
          delivery={delivery}
          onClose={() => setShowCompletion(false)}
        />
      )}

      {/* Fail delivery sheet */}
      <Sheet open={showFailSheet} onOpenChange={setShowFailSheet}>
        <SheetContent side="bottom" className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-red)]" />
                Cannot Complete Delivery
              </SheetTitle>
              <button onClick={() => setShowFailSheet(false)} className="tap-target">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </SheetHeader>
          <div className="space-y-4">
            <Select value={failReason} onValueChange={(value) => setFailReason(value as FailReason)}>
              <SelectTrigger className="h-12 bg-[var(--bg-card-2)] border-[var(--border-color)] text-foreground rounded-xl">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
                {FAIL_REASONS.map(reason => (
                  <SelectItem
                    key={reason}
                    value={reason}
                    className="text-foreground focus:bg-[var(--bg-card-2)] focus:text-foreground"
                  >
                    {FAIL_REASON_LABELS[reason]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowFailSheet(false)}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-[var(--border-color)] tap-target"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFail}
                disabled={!failReason}
                className="flex-1 h-12 rounded-xl bg-[var(--accent-red)] hover:bg-[var(--accent-red)]/90 text-white tap-target disabled:opacity-50"
              >
                Confirm Failed
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ActiveDelivery() {
  const { currentUser, deliveries } = useApp()
  const driverId = currentUser?.driverId || ''
  
  const activeDeliveries = deliveries.filter(
    d => d.driverId === driverId && !['delivered', 'failed_permanent', 'cancelled', 'posted'].includes(d.status)
  )

  if (activeDeliveries.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyMedia>
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card-2)] flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>No active deliveries</EmptyTitle>
        <EmptyDescription>Go to Available to claim a job</EmptyDescription>
      </Empty>
    )
  }

  // For Phase 1, show single job view (multi-stop in Phase 4)
  const activeDelivery = activeDeliveries[0]

  return <ActiveJobCard delivery={activeDelivery} />
}
