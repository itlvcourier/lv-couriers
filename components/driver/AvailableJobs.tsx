'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { toast } from 'sonner'
import { Truck, Package, MapPin, Zap, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { Delivery, ManifestItemType } from '@/lib/types'

interface AvailableJobsProps {
  onJobClaimed?: () => void
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
  onClaim 
}: { 
  delivery: Delivery
  canClaim: boolean
  onClaim: () => void 
}) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden transition-all duration-200 hover:bg-[var(--bg-card-hover)]">
      <CardContent className="p-4">
        {/* Header: Business name + Urgent badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-medium text-foreground">{delivery.businessName}</h3>
          {delivery.isUrgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
              <Zap className="w-3 h-3" />
              Urgent
            </span>
          )}
        </div>
        
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
        
        {/* Expand/Collapse for full address */}
        <button
          onClick={() => setExpanded(!expanded)}
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
        
        {/* Claim button */}
        <Button
          onClick={onClaim}
          disabled={!canClaim}
          className="w-full h-11 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Claim
        </Button>
      </CardContent>
    </Card>
  )
}

export function AvailableJobs({ onJobClaimed }: AvailableJobsProps) {
  const { currentUser, deliveries, claimDelivery, canDriverClaimJob, getDriverActiveJobs, getDriverMaxJobs } = useApp()
  const driverId = currentUser?.driverId || ''
  
  const availableDeliveries = deliveries.filter(d => d.status === 'posted')
  const canClaim = canDriverClaimJob(driverId)
  const activeJobs = getDriverActiveJobs(driverId)
  const maxJobs = getDriverMaxJobs(driverId)

  const handleClaim = (deliveryId: string) => {
    claimDelivery(deliveryId, driverId)
    toast.success('Delivery claimed successfully')
    onJobClaimed?.()
  }

  return (
    <div className="space-y-4">
      {/* Max jobs warning banner */}
      {!canClaim && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">
            You have {activeJobs}/{maxJobs} active jobs. Complete a delivery first.
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
