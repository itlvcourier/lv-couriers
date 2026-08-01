'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useApp } from '@/lib/context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Mail,
  Phone,
  ChevronRight,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Send,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import type { AdminNotificationType } from '@/lib/types'

// ─── Notification configs ─────────────────────────────────────────────────────

const NOTIF_CONFIGS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  new_job:          { icon: Package,       color: 'text-blue-400 bg-blue-500/10',   label: 'New Job' },
  flag:             { icon: Flag,          color: 'text-red-400 bg-red-500/10',     label: 'Flag' },
  sla_breach:       { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/10', label: 'SLA Breach' },
  driver_timeout:   { icon: Clock,         color: 'text-yellow-400 bg-yellow-500/10', label: 'Driver Timeout' },
  payment_received: { icon: CheckCircle,   color: 'text-green-400 bg-green-500/10', label: 'Payment' },
  system:           { icon: Bell,          color: 'text-gray-400 bg-gray-500/10',   label: 'System' },
  timeout:          { icon: Clock,         color: 'text-yellow-400 bg-yellow-500/10', label: 'Timeout' },
  completion:       { icon: CheckCircle,   color: 'text-green-400 bg-green-500/10', label: 'Delivery' },
  invoice:          { icon: FileText,      color: 'text-gray-400 bg-gray-500/10',   label: 'Invoice' },
  driver_deactivated: { icon: UserX,       color: 'text-red-400 bg-red-500/10',     label: 'Driver' },
}

// ─── SMS type / status configs ────────────────────────────────────────────────

const SMS_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  pickup_alert:     { label: 'Pickup Alert',     color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  tracking_link:    { label: 'Tracking Link',    color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  delivery_confirm: { label: 'Delivered',        color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed_attempt:   { label: 'Failed Attempt',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  invoice_reminder: { label: 'Invoice Reminder', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  overdue_notice:   { label: 'Overdue Notice',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  driver_reassigned:{ label: 'Reassigned',       color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  en_route_pickup:  { label: 'En Route Pickup',  color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  en_route_dropoff: { label: 'En Route Dropoff', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  feedback_request: { label: 'Feedback Request', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
}

const SMS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sent:      { label: 'Sent',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delivered: { label: 'Delivered', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  failed:    { label: 'Failed',    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  bounced:   { label: 'Bounced',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function groupByDate<T extends { sent_at: string }>(items: T[]) {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const d = new Date(item.sent_at)
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

// ─── Raw sms_log row ──────────────────────────────────────────────────────────

type SmsRow = {
  id: string
  delivery_id: string | null
  invoice_id: string | null
  driver_id: string | null
  recipient_phone: string
  sms_type: string
  message_body: string
  status: string
  error_message: string | null
  sent_at: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminCommunications() {
  const { adminNotifications, markAdminNotificationRead, retrySMS } = useApp()

  // Notifications state
  const [notifFilter, setNotifFilter] = useState<string>('all')

  // SMS state
  const [smsSearch,      setSmsSearch]      = useState('')
  const [smsTypeFilter,  setSmsTypeFilter]  = useState('all')
  const [smsStatusFilter,setSmsStatusFilter]= useState('all')
  const [smsPage,        setSmsPage]        = useState(1)
  const [selectedSms,    setSelectedSms]    = useState<SmsRow | null>(null)
  const [retryPhone,     setRetryPhone]     = useState('')
  const smsPageSize = 50

  // ── SMS fetch ──────────────────────────────────────────────────────────────

  const fetchSms = async () => {
    const supabase = createClient()
    let query = supabase
      .from('sms_log')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range((smsPage - 1) * smsPageSize, smsPage * smsPageSize - 1)

    if (smsTypeFilter   !== 'all') query = query.eq('sms_type', smsTypeFilter)
    if (smsStatusFilter !== 'all') query = query.eq('status',   smsStatusFilter)
    if (smsSearch.trim()) {
      query = query.or(`recipient_phone.ilike.%${smsSearch}%,message_body.ilike.%${smsSearch}%`)
    }

    const { data, count, error } = await query
    if (error) return { rows: [] as SmsRow[], total: 0 }
    return { rows: (data || []) as SmsRow[], total: count || 0 }
  }

  const { data: smsData, isLoading: smsLoading, mutate: smsMutate } = useSWR(
    ['sms-log', smsPage, smsTypeFilter, smsStatusFilter, smsSearch],
    fetchSms,
    { refreshInterval: 30000 },
  )

  const smsRows    = smsData?.rows  || []
  const smsTotal   = smsData?.total || 0
  const smsTotalPages = Math.ceil(smsTotal / smsPageSize)
  const grouped    = groupByDate(smsRows)

  // ── Notification helpers ───────────────────────────────────────────────────

  const filteredNotifications = notifFilter === 'all'
    ? adminNotifications
    : adminNotifications.filter(n => n.type === notifFilter)

  const unreadCount = adminNotifications.filter(n => !n.read).length

  // ── SMS preview actions ────────────────────────────────────────────────────

  const handleRetrySms = () => {
    if (!selectedSms) return
    retrySMS(selectedSms.id)
    smsMutate()
    setSelectedSms(null)
    setRetryPhone('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Communications</h2>
        <p className="text-sm text-muted-foreground">Notifications and outbound message log</p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="w-full grid grid-cols-2 bg-[var(--bg-card)] border border-[var(--border-color)]">
          <TabsTrigger value="notifications" className="gap-2 text-sm">
            <Bell className="w-4 h-4" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-[var(--accent-orange)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2 text-sm">
            <MessageSquare className="w-4 h-4" />
            SMS Log
            {smsTotal > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({smsTotal})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Notifications tab ─────────────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={notifFilter} onValueChange={setNotifFilter}>
              <SelectTrigger className="w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="flag">Flags</SelectItem>
                <SelectItem value="timeout">Timeouts</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="completion">Deliveries</SelectItem>
                <SelectItem value="sla_breach">SLA Breach</SelectItem>
                <SelectItem value="new_job">New Jobs</SelectItem>
              </SelectContent>
            </Select>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                onClick={() => adminNotifications.filter(n => !n.read).forEach(n => markAdminNotificationRead(n.id))}
              >
                Mark all read
              </button>
            )}
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Bell className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                {notifFilter !== 'all' ? 'Try a different filter' : 'Activity will appear here'}
              </p>
            </div>
          ) : (
            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardContent className="p-0">
                <div className="divide-y divide-[var(--border-color)]">
                  {filteredNotifications.map(notif => {
                    const cfg  = NOTIF_CONFIGS[notif.type] ?? { icon: Bell, color: 'text-gray-400 bg-gray-500/10', label: formatLabel(notif.type) }
                    const Icon = cfg.icon
                    return (
                      <div
                        key={notif.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => markAdminNotificationRead(notif.id)}
                        onKeyDown={e => e.key === 'Enter' && markAdminNotificationRead(notif.id)}
                        className={cn(
                          'p-4 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer flex items-start gap-3',
                          !notif.read && 'bg-[var(--bg-card-2)]',
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{notif.title}</span>
                            {!notif.read && <span className="w-2 h-2 rounded-full bg-[var(--accent-orange)] shrink-0" />}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground/70">
                              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── SMS Log tab ───────────────────────────────────────────────── */}
        <TabsContent value="sms" className="mt-4 space-y-4">
          {/* SMS filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search phone or message..."
                value={smsSearch}
                onChange={e => { setSmsSearch(e.target.value); setSmsPage(1) }}
                className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
              />
            </div>
            <Select value={smsTypeFilter} onValueChange={v => { setSmsTypeFilter(v); setSmsPage(1) }}>
              <SelectTrigger className="w-full sm:w-44 bg-[var(--bg-card)] border-[var(--border-color)]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(SMS_TYPE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={smsStatusFilter} onValueChange={v => { setSmsStatusFilter(v); setSmsPage(1) }}>
              <SelectTrigger className="w-full sm:w-36 bg-[var(--bg-card)] border-[var(--border-color)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {smsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : smsRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No SMS messages</p>
              <p className="text-xs text-muted-foreground mt-1">
                {smsSearch || smsTypeFilter !== 'all' || smsStatusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Outbound SMS will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                    <div className="flex-1 h-px bg-[var(--border-color)]" />
                    <span className="text-xs text-muted-foreground">{items.length} messages</span>
                  </div>

                  <Card className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden">
                    <CardContent className="p-0">
                      <div className="divide-y divide-[var(--border-color)]">
                        {items.map(sms => {
                          const typeCfg   = SMS_TYPE_CONFIG[sms.sms_type]   || { label: formatLabel(sms.sms_type), color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
                          const statusCfg = SMS_STATUS_CONFIG[sms.status]   || { label: formatLabel(sms.status),   color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
                          const canRetry  = sms.status === 'failed' || sms.status === 'bounced'

                          return (
                            <div
                              key={sms.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedSms(sms)}
                              onKeyDown={e => e.key === 'Enter' && setSelectedSms(sms)}
                              className="p-3.5 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-md bg-[var(--accent-orange)]/10 flex items-center justify-center shrink-0">
                                  <Send className="w-3.5 h-3.5 text-[var(--accent-orange)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1 text-sm text-foreground">
                                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                      {sms.recipient_phone}
                                    </span>
                                    <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5 py-0', typeCfg.color)}>
                                      {typeCfg.label}
                                    </Badge>
                                    <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5 py-0', statusCfg.color)}>
                                      {statusCfg.label}
                                    </Badge>
                                    {canRetry && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                                        Retry Available
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {sms.message_body}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                                    {formatDistanceToNow(new Date(sms.sent_at), { addSuffix: true })} &middot; {format(new Date(sms.sent_at), 'h:mm a')}
                                  </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {smsTotalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-muted-foreground">
                Page {smsPage} of {smsTotalPages} &middot; {smsTotal} messages
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSmsPage(p => Math.max(1, p - 1))} disabled={smsPage === 1}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSmsPage(p => Math.min(smsTotalPages, p + 1))} disabled={smsPage === smsTotalPages}>
                  Next
                  <ChevronRightIcon className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── SMS Detail Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={!!selectedSms} onOpenChange={open => !open && setSelectedSms(null)}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)] w-full sm:max-w-md overflow-y-auto">
          {selectedSms && (() => {
            const typeCfg   = SMS_TYPE_CONFIG[selectedSms.sms_type]   || { label: formatLabel(selectedSms.sms_type),   color: '' }
            const statusCfg = SMS_STATUS_CONFIG[selectedSms.status]   || { label: formatLabel(selectedSms.status),     color: '' }
            const canRetry  = selectedSms.status === 'failed' || selectedSms.status === 'bounced'
            return (
              <>
                <SheetHeader className="border-b border-[var(--border-color)] pb-4">
                  <SheetTitle className="text-foreground">SMS Details</SheetTitle>
                </SheetHeader>

                <div className="mt-5 space-y-5">
                  {/* Meta */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="outline" className={cn('text-xs', typeCfg.color)}>{typeCfg.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <Badge variant="outline" className={cn('text-xs', statusCfg.color)}>{statusCfg.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Recipient</span>
                      <span className="text-sm text-foreground font-mono">{selectedSms.recipient_phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Sent</span>
                      <span className="text-sm text-foreground">
                        {format(new Date(selectedSms.sent_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {selectedSms.delivery_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Delivery ID</span>
                        <span className="text-xs text-muted-foreground font-mono">{selectedSms.delivery_id.slice(0, 8)}…</span>
                      </div>
                    )}
                  </div>

                  {/* Message body */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">Message</span>
                    <div className="rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-color)] p-3">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedSms.message_body}
                      </p>
                    </div>
                  </div>

                  {/* Error */}
                  {selectedSms.error_message && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                      <p className="text-xs font-medium text-destructive mb-1">Error</p>
                      <p className="text-sm text-destructive/80">{selectedSms.error_message}</p>
                    </div>
                  )}

                  {/* Retry */}
                  {canRetry && (
                    <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                      <p className="text-sm font-medium text-foreground">Retry SMS</p>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Confirm phone number</label>
                        <Input
                          value={retryPhone || selectedSms.recipient_phone}
                          onChange={e => setRetryPhone(e.target.value)}
                          className="bg-[var(--bg-card-2)] border-[var(--border-color)] font-mono text-sm"
                          placeholder="Phone number"
                        />
                      </div>
                      <Button
                        onClick={handleRetrySms}
                        className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Message
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
