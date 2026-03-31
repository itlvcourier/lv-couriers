'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyIcon, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { 
  MapPin, 
  Package, 
  Building2,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react'
import { toast } from 'sonner'
import { getAvailableDeliveriesGrouped, claimDelivery, claimBundle } from '@/lib/db'
import type { DeliveryBundle, DbDelivery } from '@/lib/types'

interface AvailableJobsProps {
  driverId: string
  onJobClaimed?: () => void
}

export function AvailableJobs({ driverId, onJobClaimed }: AvailableJobsProps) {
  const { data: bundles, error, isLoading, mutate } = useSWR(
    'available-deliveries',
    getAvailableDeliveriesGrouped,
    { refreshInterval: 30000 }
  )

  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null)

  const handleClaimSingle = async (delivery: DbDelivery) => {
    setClaimingId(delivery.id)
    try {
      await claimDelivery(delivery.id, driverId)
      toast.success('Job claimed successfully!')
      mutate()
      onJobClaimed?.()
    } catch (error) {
      toast.error('Failed to claim job')
      console.error(error)
    } finally {
      setClaimingId(null)
    }
  }

  const handleClaimBundle = async (bundle: DeliveryBundle) => {
    setClaimingId(bundle.bundle_id)
    try {
      await claimBundle(bundle.bundle_id, driverId)
      toast.success(`Claimed ${bundle.deliveries.length} deliveries!`)
      mutate()
      onJobClaimed?.()
    } catch (error) {
      toast.error('Failed to claim bundle')
      console.error(error)
    } finally {
      setClaimingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty>
        <EmptyIcon>
          <Package className="w-10 h-10" />
        </EmptyIcon>
        <EmptyTitle>Error loading jobs</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  if (!bundles || bundles.length === 0) {
    return (
      <Empty>
        <EmptyIcon>
          <Package className="w-10 h-10" />
        </EmptyIcon>
        <EmptyTitle>No jobs available</EmptyTitle>
        <EmptyDescription>Check back soon for new delivery opportunities</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Available Jobs</h2>
        <Badge variant="secondary">{bundles.reduce((acc, b) => acc + b.deliveries.length, 0)} jobs</Badge>
      </div>

      {bundles.map((bundle) => (
        <Card key={bundle.bundle_id} className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{bundle.business_name}</CardTitle>
                {bundle.deliveries.length > 1 && (
                  <Badge variant="secondary" className="gap-1">
                    <Layers className="w-3 h-3" />
                    {bundle.deliveries.length} stops
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-primary">
                  ${bundle.total_payout.toFixed(2)}
                </span>
                {bundle.deliveries.length > 1 && (
                  <p className="text-xs text-muted-foreground">total</p>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Pickup location */}
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-3 h-3 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Pickup</p>
                <p className="text-sm text-muted-foreground truncate">{bundle.pickup_address}</p>
              </div>
            </div>

            {/* Show deliveries */}
            {bundle.deliveries.length === 1 ? (
              <SingleDeliveryCard 
                delivery={bundle.deliveries[0]} 
                onClaim={() => handleClaimSingle(bundle.deliveries[0])}
                claiming={claimingId === bundle.deliveries[0].id}
              />
            ) : (
              <BundleDeliveriesCard
                bundle={bundle}
                expanded={expandedBundle === bundle.bundle_id}
                onToggle={() => setExpandedBundle(
                  expandedBundle === bundle.bundle_id ? null : bundle.bundle_id
                )}
                onClaimAll={() => handleClaimBundle(bundle)}
                onClaimSingle={handleClaimSingle}
                claiming={claimingId === bundle.bundle_id}
                claimingSingleId={claimingId}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SingleDeliveryCard({ 
  delivery, 
  onClaim, 
  claiming 
}: { 
  delivery: DbDelivery
  onClaim: () => void
  claiming: boolean 
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin className="w-3 h-3 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Dropoff</p>
          <p className="text-sm text-muted-foreground truncate">{delivery.dropoff_address}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Package className="w-4 h-4" />
          {delivery.package_size}
        </span>
        {delivery.distance && (
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {delivery.distance}
          </span>
        )}
        {delivery.priority === 'rush' && (
          <Badge variant="destructive" className="text-xs">RUSH</Badge>
        )}
      </div>

      <Button 
        className="w-full" 
        onClick={onClaim}
        disabled={claiming}
      >
        {claiming ? <Spinner className="mr-2" /> : null}
        {claiming ? 'Claiming...' : 'Claim Job'}
      </Button>
    </>
  )
}

function BundleDeliveriesCard({
  bundle,
  expanded,
  onToggle,
  onClaimAll,
  onClaimSingle,
  claiming,
  claimingSingleId,
}: {
  bundle: DeliveryBundle
  expanded: boolean
  onToggle: () => void
  onClaimAll: () => void
  onClaimSingle: (delivery: DbDelivery) => void
  claiming: boolean
  claimingSingleId: string | null
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
      >
        <span className="text-sm font-medium">
          {bundle.deliveries.length} deliveries from this location
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 pl-8 border-l-2 border-border">
          {bundle.deliveries.map((delivery, index) => (
            <div key={delivery.id} className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-medium text-red-500">
                      {index + 1}
                    </span>
                    <p className="text-sm font-medium truncate">{delivery.dropoff_contact}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1 ml-7">
                    {delivery.dropoff_address}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-medium text-primary">${Number(delivery.payout).toFixed(2)}</span>
                  {delivery.priority === 'rush' && (
                    <Badge variant="destructive" className="text-xs ml-2">RUSH</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 ml-7">
                <Badge variant="outline" className="text-xs">{delivery.package_size}</Badge>
                {delivery.distance && (
                  <span className="text-xs text-muted-foreground">{delivery.distance}</span>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="ml-auto text-xs h-7"
                  onClick={() => onClaimSingle(delivery)}
                  disabled={claimingSingleId === delivery.id}
                >
                  {claimingSingleId === delivery.id ? 'Claiming...' : 'Claim this only'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button 
        className="w-full" 
        onClick={onClaimAll}
        disabled={claiming}
      >
        {claiming ? <Spinner className="mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
        {claiming ? 'Claiming...' : `Claim All ${bundle.deliveries.length} Deliveries`}
      </Button>
    </>
  )
}
