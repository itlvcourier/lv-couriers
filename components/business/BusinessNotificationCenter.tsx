'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Bell,
  Package,
  CheckCircle,
  XCircle,
  Truck,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/context'

type BusinessNotification = {
  id: string
  type: 'delivery_posted' | 'delivery_claimed' | 'delivery_picked_up' | 'delivery_completed' | 'delivery_cancelled' | 'delivery_failed' | 'invoice_ready'
  title: string
  message: string
  deliveryId?: string
  timestamp: string
  read: boolean
}

const NOTIFICATION_ICONS: Record<BusinessNotification['type'], React.ElementType> = {
  delivery_posted: Package,
  delivery_claimed: Truck,
  delivery_picked_up: Truck,
  delivery_completed: CheckCircle,
  delivery_cancelled: XCircle,
  delivery_failed: AlertTriangle,
  invoice_ready: FileText,
}

const NOTIFICATION_COLORS: Record<BusinessNotification['type'], string> = {
  delivery_posted: 'text-blue-400 bg-blue-500/10',
  delivery_claimed: 'text-yellow-400 bg-yellow-500/10',
  delivery_picked_up: 'text-orange-400 bg-orange-500/10',
  delivery_completed: 'text-green-400 bg-green-500/10',
  delivery_cancelled: 'text-gray-400 bg-gray-500/10',
  delivery_failed: 'text-red-400 bg-red-500/10',
  invoice_ready: 'text-purple-400 bg-purple-500/10',
}

export function BusinessNotificationCenter() {
  const { deliveries, currentUser } = useApp()
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  
  // Generate notifications from delivery status changes
  const notifications = useMemo(() => {
    if (!currentUser?.businessId) return []
    
    const businessDeliveries = deliveries.filter(d => d.businessId === currentUser.businessId)
    const notifs: BusinessNotification[] = []
    
    // Generate notifications from recent deliveries (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    businessDeliveries.forEach(delivery => {
      const deliveryDate = new Date(delivery.postedAt)
      if (deliveryDate < sevenDaysAgo) return
      
      // Delivery completed
      if (delivery.status === 'delivered' && delivery.deliveredAt) {
        notifs.push({
          id: `${delivery.id}-delivered`,
          type: 'delivery_completed',
          title: 'Delivery Completed',
          message: `Order #${delivery.id.slice(-6).toUpperCase()} delivered to ${delivery.recipientName || delivery.dropoffAddress.split(',')[0]}`,
          deliveryId: delivery.id,
          timestamp: delivery.deliveredAt,
          read: readIds.has(`${delivery.id}-delivered`),
        })
      }
      
      // Delivery picked up
      if (delivery.pickedUpAt && delivery.status !== 'posted') {
        notifs.push({
          id: `${delivery.id}-picked_up`,
          type: 'delivery_picked_up',
          title: 'Order Picked Up',
          message: `Order #${delivery.id.slice(-6).toUpperCase()} is on the way`,
          deliveryId: delivery.id,
          timestamp: delivery.pickedUpAt,
          read: readIds.has(`${delivery.id}-picked_up`),
        })
      }
      
      // Delivery claimed by driver
      if (delivery.driverId && delivery.claimedAt) {
        notifs.push({
          id: `${delivery.id}-claimed`,
          type: 'delivery_claimed',
          title: 'Driver Assigned',
          message: `A driver is heading to pick up order #${delivery.id.slice(-6).toUpperCase()}`,
          deliveryId: delivery.id,
          timestamp: delivery.claimedAt,
          read: readIds.has(`${delivery.id}-claimed`),
        })
      }
      
      // Delivery cancelled
      if (delivery.status === 'cancelled' && delivery.cancelledAt) {
        notifs.push({
          id: `${delivery.id}-cancelled`,
          type: 'delivery_cancelled',
          title: 'Delivery Cancelled',
          message: `Order #${delivery.id.slice(-6).toUpperCase()} was cancelled`,
          deliveryId: delivery.id,
          timestamp: delivery.cancelledAt,
          read: readIds.has(`${delivery.id}-cancelled`),
        })
      }
      
      // Delivery failed
      if (delivery.status === 'failed_permanent') {
        notifs.push({
          id: `${delivery.id}-failed`,
          type: 'delivery_failed',
          title: 'Delivery Failed',
          message: `Order #${delivery.id.slice(-6).toUpperCase()} could not be completed`,
          deliveryId: delivery.id,
          timestamp: delivery.cancelledAt || delivery.postedAt,
          read: readIds.has(`${delivery.id}-failed`),
        })
      }
    })
    
    // Sort by timestamp descending (newest first)
    return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [deliveries, currentUser?.businessId, readIds])
  
  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = (notificationId: string) => {
    setReadIds(prev => new Set([...prev, notificationId]))
  }

  const markAllRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)))
  }

  const formatTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000)
    
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="relative h-9 w-9"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--accent-orange)] text-white text-xs font-medium flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-card border-border"
        align="end"
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 20).map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type]
                const colorClass = NOTIFICATION_COLORS[notification.type]
                
                return (
                  <button
                    key={notification.id}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3",
                      !notification.read && "bg-muted/30"
                    )}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      colorClass
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm",
                          !notification.read ? "font-medium text-foreground" : "text-muted-foreground"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent-orange)] shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
