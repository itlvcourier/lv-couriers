'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Plus,
  Clock,
  RotateCcw,
  UserRound,
  Phone,
  KeyRound,
  Navigation,
  Map,
} from 'lucide-react'
import type { Delivery, DeliveryStatus, FailReason, Trip } from '@/lib/types'

const STATUS_STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: 'claimed', label: 'Claimed' },
  { status: 'en_route_pickup', label: 'En Route to Pickup' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'en_route_dropoff', label: 'En Route to Drop-off' },
  { status: 'delivered', label: 'Delivered' },
]

const FAIL_REASONS: FailReason[] = [
  'no_one_home',
  'wrong_address',
  'package_refused',
  'access_issue',
  'other',
]

const FAIL_REASON_LABELS: Record<FailReason, string> = {
  no_one_home: 'No one home',
  wrong_address: 'Wrong address',
  package_refused: 'Package refused',
  access_issue: 'Access issue',
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

// Single Job Card in Trip View
function TripJobCard({ 
  delivery, 
  index,
  totalJobs,
  isExpanded,
  onExpand,
  onMoveUp,
  onMoveDown,
  onAction,
  canMoveUp,
  canMoveDown,
}: { 
  delivery: Delivery
  index: number
  totalJobs: number
  isExpanded: boolean
  onExpand: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAction: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const isCompleted = delivery.status === 'delivered'
  const isRetryPending = delivery.status === 'failed_retry'
  
  const getStatusLabel = () => {
    switch (delivery.status) {
      case 'claimed': return 'Claimed'
      case 'en_route_pickup': return 'En route to pickup'
      case 'picked_up': return 'Picked up'
      case 'en_route_dropoff': return 'En route to drop-off'
      case 'delivered': return 'Delivered'
      case 'failed_retry': return 'Retry Pending'
      default: return delivery.status
    }
  }
  
  const getActionLabel = () => {
    switch (delivery.status) {
      case 'claimed': return 'Start Pickup'
      case 'en_route_pickup': return 'Verify Pickup'
      case 'picked_up': return 'Start Delivery'
      case 'en_route_dropoff': return 'Complete'
      default: return null
    }
  }
  
  if (isCompleted) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)] opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-green)] flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground">{delivery.businessName}</p>
              <p className="text-xs text-muted-foreground">{delivery.dropoffArea} - Completed</p>
            </div>
            {delivery.deliveredAt && (
              <p className="text-xs text-muted-foreground">
                {new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={`bg-[var(--bg-card)] border-[var(--border-color)] ${isRetryPending ? 'border-yellow-500/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Index number */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isRetryPending ? 'bg-yellow-500/20' : 'bg-[var(--accent-orange)]'
          }`}>
            <span className={`text-sm font-medium ${isRetryPending ? 'text-yellow-400' : 'text-white'}`}>
              {index + 1}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm text-foreground">{delivery.businessName}</p>
              {delivery.isUrgent && (
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-medium">
                  Rush
                </span>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mb-2">
              {delivery.pickupArea} → {delivery.dropoffArea}
            </p>
            
            {/* Manifest summary */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {delivery.manifest.map((item, idx) => (
                <span 
                  key={idx}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-card-2)] text-xs text-muted-foreground"
                >
                  <Package className="w-3 h-3" />
                  {item.type === 'big_package' ? `${item.postedQty} big` : item.type === 'small_package' ? 'small' : item.type}
                </span>
              ))}
            </div>
            
            {/* Status */}
            <p className={`text-xs ${isRetryPending ? 'text-yellow-400' : 'text-[var(--accent-orange)]'}`}>
              {isRetryPending && <Clock className="w-3 h-3 inline mr-1" />}
              {getStatusLabel()}
            </p>
          </div>
          
          {/* Reorder buttons */}
          <div className="flex flex-col gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              disabled={!canMoveUp}
              className="p-1.5 rounded-lg bg-[var(--bg-card-2)] disabled:opacity-30 tap-target"
            >
              <ArrowUp className="w-4 h-4 text-muted-foreground" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              disabled={!canMoveDown}
              className="p-1.5 rounded-lg bg-[var(--bg-card-2)] disabled:opacity-30 tap-target"
            >
              <ArrowDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        
        {/* Expand toggle */}
        <button 
          onClick={onExpand}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-[var(--accent-blue)]"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        
        {/* Expanded view */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4">
            {/* Addresses */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[var(--accent-blue)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm text-foreground">{delivery.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[var(--accent-green)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Drop-off</p>
                  <p className="text-sm text-foreground">{delivery.dropoffAddress}</p>
                </div>
              </div>
            </div>
            
            {/* Status stepper */}
            <div className="p-3 rounded-lg bg-[var(--bg-card-2)]">
              <StatusStepper currentStatus={delivery.status} />
            </div>
            
            {/* Action button */}
            {getActionLabel() && (
              <Button
                onClick={onAction}
                className="w-full h-11 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
              >
                {getActionLabel()}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Trip View for multiple active jobs
function TripView({ 
  trip, 
  deliveries,
  onAddJob,
}: { 
  trip: Trip
  deliveries: Delivery[]
  onAddJob: () => void
}) {
  const { reorderTrip, advanceStatus, getDriverMaxJobs, getDriverActiveJobs, currentUser, settings } = useApp()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showVerification, setShowVerification] = useState<Delivery | null>(null)
  const [showCompletion, setShowCompletion] = useState<Delivery | null>(null)
  
  const driverId = currentUser?.driverId || ''
  const maxJobs = getDriverMaxJobs(driverId)
  const activeJobs = getDriverActiveJobs(driverId)
  const canAddMore = activeJobs < maxJobs && settings.allowDriverSelfClaim
  
  // Order deliveries according to trip order
  const orderedDeliveries = trip.order
    .map(id => deliveries.find(d => d.id === id))
    .filter((d): d is Delivery => !!d)
  
  const completedCount = orderedDeliveries.filter(d => d.status === 'delivered').length
  const progress = (completedCount / orderedDeliveries.length) * 100
  
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newOrder = [...trip.order]
    ;[newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    reorderTrip(trip.id, newOrder)
    toast.success('Trip order updated')
  }
  
  const handleMoveDown = (index: number) => {
    if (index === trip.order.length - 1) return
    const newOrder = [...trip.order]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    reorderTrip(trip.id, newOrder)
    toast.success('Trip order updated')
  }
  
  const handleAction = (delivery: Delivery) => {
    switch (delivery.status) {
      case 'claimed':
        advanceStatus(delivery.id)
        toast.success('En route to pickup')
        break
      case 'en_route_pickup':
        setShowVerification(delivery)
        break
      case 'picked_up':
        advanceStatus(delivery.id)
        toast.success('En route to drop-off')
        break
      case 'en_route_dropoff':
        setShowCompletion(delivery)
        break
    }
  }
  
  return (
    <div className="space-y-4 pb-20">
      {/* Trip header */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Your Trip - {orderedDeliveries.length} Jobs</h2>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {orderedDeliveries.length} completed
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>
      
      {/* Job list */}
      <div className="space-y-3">
        {orderedDeliveries.map((delivery, index) => (
          <TripJobCard
            key={delivery.id}
            delivery={delivery}
            index={index}
            totalJobs={orderedDeliveries.length}
            isExpanded={expandedId === delivery.id}
            onExpand={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            onAction={() => handleAction(delivery)}
            canMoveUp={index > 0 && delivery.status !== 'delivered'}
            canMoveDown={index < orderedDeliveries.length - 1 && delivery.status !== 'delivered'}
          />
        ))}
      </div>
      
      {/* Add another job button */}
      {canAddMore && (
        <Button
          variant="outline"
          onClick={onAddJob}
          className="w-full h-12 rounded-xl border-dashed border-[var(--border-color)] text-muted-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Job
        </Button>
      )}
      
      {/* Pickup Verification Modal */}
      {showVerification && (
        <PickupVerification
          delivery={showVerification}
          onClose={() => setShowVerification(null)}
        />
      )}
      
      {/* Delivery Completion Modal */}
      {showCompletion && (
        <DeliveryCompletion
          delivery={showCompletion}
          onClose={() => setShowCompletion(null)}
        />
      )}
    </div>
  )
}

// Single job active card (original Phase 1 design)
function ActiveJobCard({ delivery }: { delivery: Delivery }) {
  const [showVerification, setShowVerification] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [showFailSheet, setShowFailSheet] = useState(false)
  const [failReason, setFailReason] = useState<FailReason | ''>('')
  const [failNotes, setFailNotes] = useState('')
  const { advanceStatus, failDelivery, retryDelivery, escalateDelivery } = useApp()

  // Navigation helpers
  const openInGoogleMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank')
  }

  const openInWaze = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
  }

  const openInAppleMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://maps.apple.com/?q=${encoded}`, '_blank')
  }

  const openInMaps = (address: string) => {
    // Default to Google Maps, but we now have dropdown options
    openInGoogleMaps(address)
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

  const isFinalAttempt = (delivery.retryCount ?? 0) >= 1

  const resetFailForm = () => {
    setFailReason('')
    setFailNotes('')
  }

  const handleMarkFailed = () => {
    if (!failReason) return
    setShowFailSheet(false)

    if (isFinalAttempt) {
      // Second failure - auto-escalate to dispatch
      escalateDelivery(delivery.id)
      toast.error('Delivery escalated to dispatch after 2 failed attempts', {
        description: 'You can move on to your next job.',
      })
    } else {
      failDelivery(delivery.id, failReason, failNotes)
      toast.warning('Delivery flagged for retry', {
        description: 'Try again when you can, or release it to dispatch.',
      })
    }
    resetFailForm()
  }

  const handleRetryNow = () => {
    retryDelivery(delivery.id)
    toast.success('Resuming delivery')
  }

  const handleReleaseToDispatch = () => {
    escalateDelivery(delivery.id)
    toast.info('Released to dispatch', {
      description: 'A dispatcher will reassign or follow up.',
    })
  }

  const getActionButton = () => {
    switch (delivery.status) {
      case 'claimed':
        return { label: 'Start Pickup Run', color: 'bg-[var(--accent-blue)]' }
      case 'en_route_pickup':
        return { label: "I'm Here - Verify Pickup", color: 'bg-[var(--accent-orange)]' }
      case 'picked_up':
        return { label: 'Start Delivery Run', color: 'bg-[var(--accent-blue)]' }
      case 'en_route_dropoff':
        return { label: 'Mark as Delivered', color: 'bg-[var(--accent-green)]' }
      default:
        return null
    }
  }

  const actionButton = getActionButton()

  // Show retry pending view (driver flagged delivery as can't complete - one more attempt allowed)
  if (delivery.status === 'failed_retry') {
    const lastFailure = [...delivery.statusHistory]
      .reverse()
      .find(h => h.status === 'failed_retry')

    return (
      <div className="space-y-4">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-yellow-400">Needs Another Attempt</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Attempt 1 of 2 failed. One retry allowed before escalation.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{delivery.businessName}</p>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{delivery.dropoffAddress}</span>
              </p>
            </div>

            {lastFailure?.note && (
              <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm text-foreground">{lastFailure.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button
            onClick={handleRetryNow}
            className="w-full h-12 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Delivery Again
          </Button>
          <Button
            onClick={handleReleaseToDispatch}
            variant="outline"
            className="w-full h-11 rounded-xl border-[var(--border-color)]"
          >
            Release to Dispatch
          </Button>
          <p className="text-xs text-center text-muted-foreground pt-1">
            Take your time. This delivery stays here until you act on it.
          </p>
        </div>
      </div>
    )
  }

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 border-[var(--border-color)] tap-target"
                  >
                    <Navigation className="w-3 h-3" />
                    Navigate
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openInGoogleMaps(delivery.pickupAddress)}>
                    <Map className="w-4 h-4 mr-2" />
                    Google Maps
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openInWaze(delivery.pickupAddress)}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Waze
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openInAppleMaps(delivery.pickupAddress)}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Apple Maps
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Dropoff Address */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--accent-green)]" /> Drop-off
                </p>
                <p className="text-sm text-foreground">{delivery.dropoffAddress}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 border-[var(--border-color)] tap-target"
                  >
                    <Navigation className="w-3 h-3" />
                    Navigate
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openInGoogleMaps(delivery.dropoffAddress)}>
                    <Map className="w-4 h-4 mr-2" />
                    Google Maps
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openInWaze(delivery.dropoffAddress)}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Waze
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openInAppleMaps(delivery.dropoffAddress)}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Apple Maps
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {(delivery.recipientName || delivery.recipientPhone || delivery.buzzCode) && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-color)]">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-green)]/15 text-[var(--accent-green)] flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {delivery.recipientName && (
                    <p className="text-sm font-medium text-foreground truncate">
                      {delivery.recipientName}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {delivery.recipientPhone && (
                      <a
                        href={`tel:${delivery.recipientPhone}`}
                        className="flex items-center gap-1 text-[var(--accent-orange)] hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        {delivery.recipientPhone}
                      </a>
                    )}
                    {delivery.buzzCode && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <KeyRound className="w-3 h-3" />
                        Buzz {delivery.buzzCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
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
      <Sheet
        open={showFailSheet}
        onOpenChange={(open) => {
          setShowFailSheet(open)
          if (!open) resetFailForm()
        }}
      >
        <SheetContent
          side="bottom"
          className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl max-h-[90vh] overflow-y-auto"
        >
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-red)]" />
                Can&apos;t Complete Delivery
              </SheetTitle>
              <button
                onClick={() => {
                  setShowFailSheet(false)
                  resetFailForm()
                }}
                className="tap-target"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </SheetHeader>

          <div className="space-y-4">
            {/* Attempt warning banner */}
            <div
              className={`p-3 rounded-xl border ${
                isFinalAttempt
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isFinalAttempt ? 'text-red-400' : 'text-yellow-400'
                  }`}
                />
                <div className="text-xs">
                  <p
                    className={`font-medium ${
                      isFinalAttempt ? 'text-red-400' : 'text-yellow-400'
                    }`}
                  >
                    {isFinalAttempt
                      ? 'Final attempt — will escalate to dispatch'
                      : 'Attempt 1 of 2'}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {isFinalAttempt
                      ? 'This delivery has already failed once. Confirming now sends it to dispatch.'
                      : "You'll get one more chance to retry before this escalates."}
                  </p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="fail-reason" className="text-sm text-foreground">
                Reason <span className="text-red-400">*</span>
              </Label>
              <Select
                value={failReason}
                onValueChange={(value) => setFailReason(value as FailReason)}
              >
                <SelectTrigger
                  id="fail-reason"
                  className="h-12 bg-[var(--bg-card-2)] border-[var(--border-color)] text-foreground rounded-xl"
                >
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
                  {FAIL_REASONS.map((reason) => (
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
            </div>

            {/* Optional notes */}
            <div className="space-y-2">
              <Label htmlFor="fail-notes" className="text-sm text-foreground">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="fail-notes"
                placeholder="Add details to help dispatch — e.g. building locked, customer unreachable, wrong unit number"
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                rows={3}
                maxLength={300}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {failNotes.length}/300
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => {
                  setShowFailSheet(false)
                  resetFailForm()
                }}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-[var(--border-color)] tap-target"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkFailed}
                disabled={!failReason}
                className={`flex-1 h-12 rounded-xl text-white tap-target disabled:opacity-50 ${
                  isFinalAttempt
                    ? 'bg-[var(--accent-red)] hover:bg-[var(--accent-red)]/90'
                    : 'bg-yellow-500 hover:bg-yellow-500/90'
                }`}
              >
                {isFinalAttempt ? 'Escalate to Dispatch' : 'Flag for Retry'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ActiveDelivery() {
  const { currentUser, deliveries, trips, getDriverActiveJobs, getDriverMaxJobs } = useApp()
  const driverId = currentUser?.driverId || ''
  
  const activeDeliveries = deliveries.filter(
    d => d.driverId === driverId && !['delivered', 'failed_permanent', 'cancelled', 'posted'].includes(d.status)
  )
  
  // Check if driver has an active trip
  const activeTrip = trips.find(t => t.driverId === driverId && t.status === 'active')

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

  // If multiple jobs or has a trip, show Trip View
  if (activeDeliveries.length > 1 || activeTrip) {
    // Create a virtual trip if none exists
    const tripToShow: Trip = activeTrip || {
      id: 'virtual-trip',
      driverId,
      deliveryIds: activeDeliveries.map(d => d.id),
      status: 'active',
      startedAt: new Date().toISOString(),
      completedAt: null,
      order: activeDeliveries.map(d => d.id),
    }
    
    return (
      <TripView 
        trip={tripToShow} 
        deliveries={activeDeliveries}
        onAddJob={() => {
          // Switch to Available tab - handled by parent
          toast.info('Go to Available tab to add more jobs')
        }}
      />
    )
  }

  // Single job view (Phase 1 design)
  return <ActiveJobCard delivery={activeDeliveries[0]} />
}
