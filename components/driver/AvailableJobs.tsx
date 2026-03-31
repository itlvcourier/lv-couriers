'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Package } from 'lucide-react'

interface AvailableJobsProps {
  driverId: string
  onJobClaimed?: () => void
}

export function AvailableJobs({ driverId, onJobClaimed }: AvailableJobsProps) {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('deliveries')
          .select('id, pickup_address, dropoff_address, status, posted_at')
          .eq('status', 'posted')
          .limit(10)

        if (err) {
          setError(err.message)
        } else {
          setDeliveries(data || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadDeliveries()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <Empty>
        <EmptyMedia>
          <Package className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading jobs</EmptyTitle>
        <EmptyDescription>{error}</EmptyDescription>
      </Empty>
    )
  }

  if (deliveries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Package className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>No available jobs</EmptyTitle>
        <EmptyDescription>Check back soon for new delivery opportunities</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <Card key={delivery.id}>
          <CardHeader>
            <CardTitle className="text-base">{delivery.pickup_address}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Dropoff</p>
              <p className="text-sm text-muted-foreground">{delivery.dropoff_address}</p>
            </div>
            <Button className="w-full">Claim Job</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
