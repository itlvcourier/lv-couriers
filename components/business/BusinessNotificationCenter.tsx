'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Package, CheckCircle, XCircle, Truck, Clock, FileText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/context'
import { useNotificationState } from '@/lib/use-notification-state'

type BusinessNotification = {
  id: string
  type:
    | 'delivery_posted'
    | 'delivery_claimed'
    | 'delivery_picked_up'
    | 'delivery_completed'
    | 'delivery_cancelled'
    | 'delivery_failed'
    | 'invoice_ready'
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
  delivery_posted: 'text-muted-foreground bg-muted-foreground/10',
  delivery_claimed: 'text-warning bg-warning/10',
  delivery_picked_up: 'text-brand bg-brand/10',
  delivery_completed: 'text-success bg-success/10',
  delivery_cancelled: 'text-muted-foreground bg-muted-foreground/10',
  delivery_failed: 'text-destructive bg-destructive/10',
  invoice_ready: 'text-muted-foreground bg-muted-foreground/10',
}

const WINDOW_DAYS = 7
const MAX_EARLIER = 30

function formatTime(timestamp: string) {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function BusinessNotificationCenter() {
  const { deliveries, currentUser } = useApp()
  const [open, setOpen] = useState(false)
  const [showEarlier, setShowEarlier] = useState(false)
  const { ready, isRead, markRead, markAllRead } = useNotificationState(currentUser?.id)

  const notifications = useMemo(() => {
    if (!currentUser?.businessId || !ready) return []
    const cutoff = Date.now() - WINDOW_DAYS * 86400_000
    const notifs: BusinessNotification[] = []
    const push = (n: Omit<BusinessNotification, 'read'>) => {
      if (!n.timestamp || new Date(n.timestamp).getTime() < cutoff) return
      notifs.push({ ...n, read: isRead(n.id, n.timestamp) })
    }

    for (const delivery of deliveries) {
      if (delivery.businessId !== currentUser.businessId) continue
      const ref = `#${delivery.id.slice(-6).toUpperCase()}`

      if (delivery.status === 'delivered' && delivery.deliveredAt) {
        push({
          id: `${delivery.id}-delivered`,
          type: 'delivery_completed',
          title: 'Delivery completed',
          message: `Order ${ref} delivered to ${delivery.recipientName || delivery.dropoffAddress.split(',')[0]}`,
          deliveryId: delivery.id,
          timestamp: delivery.deliveredAt,
        })
      }
      if (delivery.pickedUpAt && delivery.status !== 'posted') {
        push({
          id: `${delivery.id}-picked_up`,
          type: 'delivery_picked_up',
          title: 'Order picked up',
          message: `Order ${ref} is on the way`,
          deliveryId: delivery.id,
          timestamp: delivery.pickedUpAt,
        })
      }
      if (delivery.driverId && delivery.claimedAt) {
        push({
          id: `${delivery.id}-claimed`,
          type: 'delivery_claimed',
          title: 'Driver assigned',
          message: `A driver is heading to pick up order ${ref}`,
          deliveryId: delivery.id,
          timestamp: delivery.claimedAt,
        })
      }
      if (delivery.status === 'cancelled' && delivery.cancelledAt) {
        push({
          id: `${delivery.id}-cancelled`,
          type: 'delivery_cancelled',
          title: 'Delivery cancelled',
          message: `Order ${ref} was cancelled`,
          deliveryId: delivery.id,
          timestamp: delivery.cancelledAt,
        })
      }
      if (delivery.status === 'failed_permanent') {
        push({
          id: `${delivery.id}-failed`,
          type: 'delivery_failed',
          title: 'Delivery failed',
          message: `Order ${ref} could not be completed`,
          deliveryId: delivery.id,
          timestamp: delivery.cancelledAt || delivery.postedAt,
        })
      }
    }

    return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [deliveries, currentUser?.businessId, ready, isRead])

  const unread = notifications.filter(n => !n.read)
  const earlier = notifications.filter(n => n.read).slice(0, MAX_EARLIER)
  const visible = showEarlier ? [...unread, ...earlier] : unread
  const unreadCount = unread.length

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setShowEarlier(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-border bg-card p-0" align="end">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-50" aria-hidden="true" />
              <p className="text-sm">{"You're all caught up"}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map(notification => {
                const Icon = NOTIFICATION_ICONS[notification.type]
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50',
                        !notification.read && 'bg-muted/30',
                      )}
                      onClick={() => markRead(notification.id)}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          NOTIFICATION_COLORS[notification.type],
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm',
                              notification.read ? 'text-muted-foreground' : 'font-medium text-foreground',
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        {earlier.length > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowEarlier(v => !v)}
            >
              {showEarlier ? 'Hide earlier' : `Show earlier (${earlier.length})`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
