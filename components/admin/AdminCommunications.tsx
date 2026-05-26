'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Bell, 
  MessageSquare, 
  Filter, 
  RefreshCw,
  Flag,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  UserX,
  Battery,
  Mail,
  Eye,
  Phone,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { AdminNotificationType, SMSType, SMSStatus } from '@/lib/types'

// Notification type configs
const NOTIFICATION_CONFIGS: Record<AdminNotificationType, { icon: React.ElementType; color: string; label: string }> = {
  // DB types
  new_job: { icon: AlertTriangle, color: 'text-blue-400 bg-blue-500/10', label: 'New Job' },
  flag: { icon: Flag, color: 'text-red-400 bg-red-500/10', label: 'Flag' },
  sla_breach: { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10', label: 'SLA Breach' },
  driver_timeout: { icon: Clock, color: 'text-yellow-400 bg-yellow-500/10', label: 'Driver Timeout' },
  payment_received: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10', label: 'Payment' },
  system: { icon: Bell, color: 'text-gray-400 bg-gray-500/10', label: 'System' },
  // Mock data types
  timeout: { icon: Clock, color: 'text-yellow-400 bg-yellow-500/10', label: 'Timeout' },
  completion: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10', label: 'Delivery' },
  invoice: { icon: FileText, color: 'text-gray-400 bg-gray-500/10', label: 'Invoice' },
  qty_adjustment: { icon: RefreshCw, color: 'text-orange-400 bg-orange-500/10', label: 'Qty Change' },
  driver_deactivated: { icon: UserX, color: 'text-red-400 bg-red-500/10', label: 'Driver' },
}

// SMS type configs
const SMS_CONFIGS: Record<SMSType, { label: string; color: string }> = {
  pickup_alert: { label: 'Pickup Alert', color: 'bg-blue-500/10 text-blue-400' },
  tracking_link: { label: 'Tracking Link', color: 'bg-green-500/10 text-green-400' },
  delivery_confirm: { label: 'Delivery Confirm', color: 'bg-green-500/10 text-green-400' },
  failed_attempt: { label: 'Failed Attempt', color: 'bg-red-500/10 text-red-400' },
  invoice_reminder: { label: 'Invoice Reminder', color: 'bg-yellow-500/10 text-yellow-400' },
  overdue_notice: { label: 'Overdue Notice', color: 'bg-red-500/10 text-red-400' },
}

// SMS status configs
const SMS_STATUS_CONFIGS: Record<SMSStatus, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delivered: { label: 'Delivered', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  bounced: { label: 'Bounced', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export function AdminCommunications() {
  const { adminNotifications, smsLog, markAdminNotificationRead, retrySMS } = useApp()
  const [notifFilter, setNotifFilter] = useState<'all' | AdminNotificationType>('all')
  const [selectedSMS, setSelectedSMS] = useState<string | null>(null)
  const [retryPhone, setRetryPhone] = useState('')

  // Filter notifications
  const filteredNotifications = notifFilter === 'all' 
    ? adminNotifications 
    : adminNotifications.filter(n => n.type === notifFilter)

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM d, h:mm a')
    } catch {
      return timestamp
    }
  }

  // Handle SMS retry
  const handleRetrySMS = (smsId: string) => {
    retrySMS(smsId)
    setSelectedSMS(null)
    setRetryPhone('')
  }

  const selectedSMSData = selectedSMS ? smsLog.find(s => s.id === selectedSMS) : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Communications</h1>

      <Tabs defaultValue="notifications">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS Log
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={notifFilter} onValueChange={(v) => setNotifFilter(v as typeof notifFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="flag">Flags</SelectItem>
                <SelectItem value="timeout">Timeouts</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="completion">Deliveries</SelectItem>
                <SelectItem value="sla_breach">SLA Breach</SelectItem>
                <SelectItem value="new_job">New Jobs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notifications List */}
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No notifications found
                </div>
              ) : (
                filteredNotifications.map(notification => {
                  const config = NOTIFICATION_CONFIGS[notification.type] ?? {
                    icon: Bell,
                    color: 'text-gray-400 bg-gray-500/10',
                    label: notification.type || 'Unknown',
                  }
                  const Icon = config.icon
                  
                  return (
                    <div 
                      key={notification.id}
                      onClick={() => markAdminNotificationRead(notification.id)}
                      className={cn(
                        "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                        !notification.read && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          config.color
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground">{notification.title}</span>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatTime(notification.createdAt)}</span>
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Log Tab */}
        <TabsContent value="sms" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Date/Time</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Recipient</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Phone</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Type</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {smsLog.map(sms => {
                      const typeConfig = SMS_CONFIGS[sms.type] ?? {
                        label: sms.type || 'Unknown',
                        color: 'bg-gray-500/10 text-gray-400',
                      }
                      const statusConfig = SMS_STATUS_CONFIGS[sms.status] ?? {
                        label: sms.status || 'Unknown',
                        color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
                      }
                      const canRetry = sms.status === 'failed' || sms.status === 'bounced'
                      
                      return (
                        <tr 
                          key={sms.id}
                          className="hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">
                            {formatTime(sms.sentAt)}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {sms.recipientName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {sms.recipientPhone}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("text-xs", typeConfig.color)}>
                              {typeConfig.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                              {statusConfig.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {canRetry && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSMS(sms.id)}
                                className="h-7 text-xs"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Retry SMS Sheet */}
      <Sheet open={!!selectedSMS} onOpenChange={() => setSelectedSMS(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Retry SMS</SheetTitle>
          </SheetHeader>
          
          {selectedSMSData && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Original Message</p>
                <p className="text-sm text-foreground">{selectedSMSData.message}</p>
              </div>
              
              {selectedSMSData.errorMessage && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    Error: {selectedSMSData.errorMessage}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm Phone Number</label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={retryPhone || selectedSMSData.recipientPhone}
                    onChange={(e) => setRetryPhone(e.target.value)}
                    placeholder="Phone number"
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSMS(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRetrySMS(selectedSMSData.id)}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend SMS
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
