'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Truck, Star } from 'lucide-react'
import type { DbDriver } from '@/lib/types'

interface DriverHeaderProps {
  driver: DbDriver
}

export function DriverHeader({ driver }: DriverHeaderProps) {
  const statusColors = {
    available: 'bg-green-500/10 text-green-500 border-green-500/20',
    on_delivery: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    offline: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <div className="bg-card/50 border-b border-border p-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">LV Couriers</h1>
            <p className="text-sm text-muted-foreground">Driver Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="font-medium">{driver.name}</p>
            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              <span>{driver.rating}</span>
              <span className="mx-1">·</span>
              <span>{driver.total_deliveries} deliveries</span>
            </div>
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={driver.avatar || undefined} />
            <AvatarFallback>{driver.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <Badge variant="outline" className={statusColors[driver.status]}>
            {driver.status === 'on_delivery' ? 'On Delivery' : driver.status === 'available' ? 'Available' : 'Offline'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
