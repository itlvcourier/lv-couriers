'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Bell,
  Flag,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Settings,
  Package
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { AdminNotificationType } from '@/lib/types'

const NOTIFICATION_ICONS: Record<AdminNotificationType, React.ElementType> = {
  new_job: Package,
  flag: Flag,
  sla_breach: AlertTriangle,
  driver_timeout: Clock,
  payment_received: CreditCard,
  system: Settings,
}

const NOTIFICATION_COLORS: Record<AdminNotificationType, string> = {
  new_job: 'text-blue-400 bg-blue-500/10',
  flag: 'text-red-400 bg-red-500/10',
  sla_breach: 'text-orange-400 bg-orange-500/10',
  driver_timeout: 'text-yellow-400 bg-yellow-500/10',
  payment_received: 'text-green-400 bg-green-500/10',
  system: 'text-gray-400 bg-gray-500/10',
}

export function NotificationCenter() {
  const { adminNotifications, markAdminNotificationRead, markAllAdminNotificationsRead } = useApp()
  const [open, setOpen] = useState(false)
  
  const unreadCount = adminNotifications.filter(n => !n.read).length

  const handleNotificationClick = (notificationId: string) => {
    markAdminNotificationRead(notificationId)
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
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-card border-border"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAdminNotificationsRead()}
              className="text-xs text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        
        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {adminNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-border">
              {adminNotifications.map(notification => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Bell
                const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-gray-400 bg-gray-500/10'
                
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id)}
                    className={cn(
                      "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.read && "bg-muted/30"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        colorClass
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm text-foreground",
                          !notification.read && "font-medium"
                        )}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Link href="/admin/communications">
            <Button 
              variant="ghost" 
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
