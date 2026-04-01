'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { History } from 'lucide-react'

interface DriverHistoryProps {
  driverId: string
}

export function DriverHistory({ driverId }: DriverHistoryProps) {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDeliveries = async () => {
      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('deliveries')
          .select('id, pickup_address, dropoff_address, status, completed_at')
          .eq('status', 'completed')
          .limit(20)

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
          <History className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading history</EmptyTitle>
        <EmptyDescription>{error}</EmptyDescription>
      </Empty>
    )
  }

  if (deliveries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <History className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>No delivery history</EmptyTitle>
        <EmptyDescription>Completed deliveries will appear here</EmptyDescription>
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
          <CardContent>
            <div>
              <p className="text-sm font-medium mb-1">Dropoff</p>
              <p className="text-sm text-muted-foreground">{delivery.dropoff_address}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
