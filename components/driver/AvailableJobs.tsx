'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Truck, Package, MapPin, Zap, AlertTriangle, ChevronDown, ChevronUp, X, Check, Clock } from 'lucide-react'
import type { Delivery, ManifestItemType } from '@/lib/types'

interface AvailableJobsProps {
  onJobClaimed?: () => void
}

// Calculate remaining SLA time for rush jobs (45 min from posted time)
function getRushSlaRemaining(postedAt: string, slaMins: number = 45): { mins: number; secs: number; breached: boolean } {
  const posted = new Date(postedAt).getTime()
  const deadline = posted + (slaMins * 60 * 1000)
  const now = Date.now()
  const remaining = deadline - now
  
  if (remaining <= 0) {
    return { mins: 0, secs: 0, breached: true }
  }
  
  const totalSecs = Math.floor(remaining / 1000)
  return {
    mins: Math.floor(totalSecs / 60),
    secs: totalSecs % 60,
    breached: false,
  }
}

function RushSlaTimer({ postedAt, slaMins = 45 }: { postedAt: string; slaMins?: number }) {
  const [sla, setSla] = useState(getRushSlaRemaining(postedAt, slaMins))
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSla(getRushSlaRemaining(postedAt, slaMins))
    }, 1000)
    return () => clearInterval(interval)
  }, [postedAt, slaMins])
  
  if (sla.breached) {
    return (
      <span className="text-xs font-medium text-red-400 animate-pulse">
        SLA BREACHED
      </span>
    )
  }
  
  const isUrgent = sla.mins < 15
  const isCritical = sla.mins < 5
  
  return (
    <span className={`text-xs font-mono font-medium flex items-center gap-1 ${
      isCritical ? 'text-red-400 animate-pulse' : isUrgent ? 'text-red-400' : 'text-orange-400'
    }`}>
      <Clock className="w-3 h-3" />
      Pickup due in {sla.mins}:{sla.secs.toString().padStart(2, '0')}
    </span>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  return `${Math.floor(diffHours / 24)}d ago`
}

function getManifestIcon(type: ManifestItemType) {
  switch (type) {
    case 'small_package':
      return <Package className="w-4 h-4" />
    case 'big_package':
      return <Package className="w-4 h-4" />
    case 'out_of_town':
      return <MapPin className="w-4 h-4" />
    case 'rush':
      return <Zap className="w-4 h-4" />
    default:
      return <Package className="w-4 h-4" />
  }
}

function getManifestLabel(type: ManifestItemType, qty: number) {
  switch (type) {
    case 'small_package':
      return 'Small'
    case 'big_package':
      return qty > 1 ? `Big x${qty}` : 'Big'
    case 'out_of_town':
      return 'OOT'
    case 'rush':
      return 'Rush'
    default:
      return type
  }
}

function JobCard({ 
  delivery, 
  canClaim, 
  onClaim,
  selectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
  canSelect,
}: { 
  delivery: Delivery
  canClaim: boolean
  onClaim: () => void
  selectionMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
  onLongPress: () => void
  canSelect: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)
  
  const handleTouchStart = () => {
    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      onLongPress()
    }, 500)
  }
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }
  
  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect()
    }
  }
  
  return (
    <Card 
      className={`bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden transition-all duration-200 hover:bg-[var(--bg-card-hover)] ${
        isSelected ? 'border-[var(--accent-orange)] ring-2 ring-[var(--accent-orange)]/30' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        {/* Header: Selection checkbox + Business name + Urgent badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {selectionMode && (
              <div className="relative">
                <Checkbox 
                  checked={isSelected} 
                  onCheckedChange={() => onToggleSelect()}
                  disabled={!canSelect && !isSelected}
                  className="data-[state=checked]:bg-[var(--accent-orange)] data-[state=checked]:border-[var(--accent-orange)]"
                />
              </div>
            )}
            <h3 className="font-medium text-foreground">{delivery.businessName}</h3>
          </div>
          {delivery.isUrgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
              <Zap className="w-3 h-3" />
              Rush
            </span>
          )}
        </div>
        
        {/* Rush SLA Timer */}
        {delivery.isUrgent && (
          <div className="mb-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <RushSlaTimer postedAt={delivery.postedAt} />
          </div>
        )}
        
        {/* Selected overlay checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full bg-[var(--accent-orange)] flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
        
        {/* Manifest icons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {delivery.manifest.map((item, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-card-2)] text-xs text-muted-foreground"
            >
              {getManifestIcon(item.type)}
              {getManifestLabel(item.type, item.postedQty)}
            </span>
          ))}
        </div>
        
        {/* Route */}
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-foreground">{delivery.pickupArea}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-foreground">{delivery.dropoffArea}</span>
        </div>
        
        {/* Time posted */}
        <p className="text-xs text-muted-foreground mb-3">
          {formatTimeAgo(delivery.postedAt)}
        </p>
        
        {/* Notes if any */}
        {delivery.manifest.some(m => m.notes) && (
          <p className="text-xs text-muted-foreground italic mb-3">
            {delivery.manifest.find(m => m.notes)?.notes}
          </p>
        )}
        
        {/* Expand/Collapse for full address - only when not in selection mode */}
        {!selectionMode && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              className="flex items-center gap-1 text-xs text-[var(--accent-blue)] mb-3"
            >
              {expanded ? 'Hide details' : 'Show details'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            
            {expanded && (
              <div className="space-y-2 mb-4 p-3 rounded-lg bg-[var(--bg-card-2)]">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                  <p className="text-sm text-foreground">{delivery.pickupAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Drop-off</p>
                  <p className="text-sm text-foreground">{delivery.dropoffAddress}</p>
                </div>
              </div>
            )}
            
            {/* Claim button - only show when not in selection mode */}
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClaim()
              }}
              disabled={!canClaim}
              className="w-full h-11 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Claim
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function AvailableJobs({ onJobClaimed }: AvailableJobsProps) {
  const { currentUser, deliveries, claimDelivery, claimMultiple, canDriverClaimJob, getDriverActiveJobs, getDriverMaxJobs } = useApp()
  const driverId = currentUser?.driverId || ''
  
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  
  const availableDeliveries = deliveries.filter(d => d.status === 'posted')
  const canClaim = canDriverClaimJob(driverId)
  const activeJobs = getDriverActiveJobs(driverId)
  const maxJobs = getDriverMaxJobs(driverId)
  const remainingSlots = maxJobs - activeJobs

  const handleClaim = (deliveryId: string) => {
    claimDelivery(deliveryId, driverId)
    toast.success('Delivery claimed successfully')
    onJobClaimed?.()
  }
  
  const handleLongPress = () => {
    if (!selectionMode && canClaim) {
      setSelectionMode(true)
      toast.info('Selection mode - tap jobs to select')
    }
  }
  
  const handleToggleSelect = (deliveryId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(deliveryId)) {
        return prev.filter(id => id !== deliveryId)
      }
      // Check if we can add more
      if (prev.length >= remainingSlots) {
        toast.error(`Max ${maxJobs} jobs - deselect one to add this`)
        return prev
      }
      return [...prev, deliveryId]
    })
  }
  
  const handleCancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds([])
  }
  
  const handleClaimMultiple = () => {
    setShowConfirmSheet(true)
  }
  
  const handleConfirmClaimAll = () => {
    claimMultiple(selectedIds, driverId)
    toast.success(`${selectedIds.length} jobs claimed - your trip is ready`)
    setShowConfirmSheet(false)
    setSelectionMode(false)
    setSelectedIds([])
    onJobClaimed?.()
  }
  
  const selectedDeliveries = availableDeliveries.filter(d => selectedIds.includes(d.id))

  return (
    <div className="space-y-4 pb-20">
      {/* Max jobs warning banner */}
      {!canClaim && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">
            You have {activeJobs}/{maxJobs} active jobs. Complete a delivery first.
          </p>
        </div>
      )}
      
      {/* Selection mode hint */}
      {!selectionMode && canClaim && availableDeliveries.length > 1 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-color)]">
          <p className="text-xs text-muted-foreground">
            Tip: Long press any job to select multiple
          </p>
        </div>
      )}
      
      {availableDeliveries.length === 0 ? (
        <Empty className="py-12">
          <EmptyMedia>
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card-2)] flex items-center justify-center">
              <Truck className="w-8 h-8 text-muted-foreground" />
            </div>
          </EmptyMedia>
          <EmptyTitle>No deliveries available right now</EmptyTitle>
          <EmptyDescription>Check back soon for new jobs</EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-3">
          {availableDeliveries.map((delivery) => (
            <JobCard
              key={delivery.id}
              delivery={delivery}
              canClaim={canClaim}
              onClaim={() => handleClaim(delivery.id)}
              selectionMode={selectionMode}
              isSelected={selectedIds.includes(delivery.id)}
              onToggleSelect={() => handleToggleSelect(delivery.id)}
              onLongPress={handleLongPress}
              canSelect={selectedIds.length < remainingSlots}
            />
          ))}
        </div>
      )}
      
      {/* Selection mode bottom bar */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border-color)] p-4 safe-area-bottom z-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{selectedIds.length}</span> job{selectedIds.length !== 1 ? 's' : ''} selected
              <span className="text-muted-foreground"> ({remainingSlots} max)</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancelSelection}
              className="flex-1 h-12 rounded-xl border-[var(--border-color)]"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleClaimMultiple}
              disabled={selectedIds.length === 0}
              className="flex-1 h-12 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
            >
              Claim {selectedIds.length} Job{selectedIds.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
      
      {/* Claim Confirmation Sheet */}
      <Sheet open={showConfirmSheet} onOpenChange={setShowConfirmSheet}>
        <SheetContent side="bottom" className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-foreground">Confirm Multi-Stop Trip</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-4 mb-6">
            <p className="text-sm text-muted-foreground">
              You&apos;re claiming {selectedIds.length} jobs. Suggested order based on proximity:
            </p>
            
            <div className="space-y-3">
              {selectedDeliveries.map((delivery, index) => (
                <div key={delivery.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-card-2)]">
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-orange)] flex items-center justify-center shrink-0">
                    <span className="text-xs text-white font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{delivery.businessName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {delivery.pickupArea} → {delivery.dropoffArea}
                    </p>
                  </div>
                  {delivery.isUrgent && (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs">
                      Rush
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmSheet(false)}
              className="flex-1 h-12 rounded-xl border-[var(--border-color)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmClaimAll}
              className="flex-1 h-12 rounded-xl bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
            >
              Confirm & Claim All
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
