'use client'

import useSWR from 'swr'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  getDashboardStats,
  getAllDeliveries,
  getDrivers,
  getBusinesses,
  getAdminNotifications,
  type DbDelivery,
  type DbDriver,
} from '@/lib/db'
import {
  Package,
  Truck,
  Building2,
  Clock,
  AlertTriangle,
  Activity,
  Zap,
  Phone,
  RefreshCw,
  Flag,
  FileText,
  AlertOctagon,
  MailWarning,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminDashboard() {
  // Invoice context (mock state)
  const { invoices, settings } = useApp()

  // Navigate to Admin > Invoices tab (and optionally preselect a status)
  const goToInvoices = (status?: 'draft' | 'sent' | 'overdue' | 'escalated') => {
    if (typeof window === 'undefined') return
    if (status) {
      try {
        sessionStorage.setItem('doms.invoices.initialStatus', status)
      } catch {
        // sessionStorage may not be available (private mode, etc.)
      }
    }
    window.dispatchEvent(new CustomEvent('doms:navigate-admin', { detail: 'invoices' }))
  }

  // --- Invoice derived state ---
  const drafts = invoices.filter(i => i.status === 'draft')
  const draftsWithIssues = drafts.filter(i => i.emailBounced || !i.billingEmail)
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')
  const escalatedInvoices = invoices.filter(i => i.status === 'escalated')

  // Review reminder: today falls within N days of the 1st
  const now = new Date()
  const dayOfMonth = now.getDate()
  const reviewWindow = settings.reviewReminderDays
  const isReviewPeriod = reviewWindow > 0 &&
    (dayOfMonth >= 28 || dayOfMonth <= 1) && drafts.length > 0

  // Days until the 1st (approximate — treats day 28 onward as approaching)
  const daysUntilFirst = dayOfMonth >= 28
    ? ((() => {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        return lastDay - dayOfMonth + 1
      })())
    : dayOfMonth === 1
      ? 0
      : undefined

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useSWR('dashboard-stats', getDashboardStats, {
    refreshInterval: 30000, // Refresh every 30 seconds
  })
  
  // Fetch deliveries
  const { data: deliveries = [], isLoading: deliveriesLoading } = useSWR('all-deliveries', () => getAllDeliveries(), {
    refreshInterval: 15000,
  })
  
  // Fetch drivers
  const { data: drivers = [], isLoading: driversLoading } = useSWR('all-drivers', getDrivers, {
    refreshInterval: 30000,
  })
  
  // Fetch businesses
  const { data: businesses = [], isLoading: businessesLoading } = useSWR('all-businesses', getBusinesses, {
    refreshInterval: 60000,
  })
  
  // Fetch admin notifications
  const { data: notifications = [] } = useSWR('admin-notifications', () => getAdminNotifications(10), {
    refreshInterval: 15000,
  })

  const isLoading = statsLoading || deliveriesLoading || driversLoading || businessesLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Calculate additional stats from deliveries
  const rushDeliveries = deliveries.filter((d: DbDelivery) => d.status === 'posted' && (d.is_rush || d.is_urgent))
  const flaggedDeliveries = deliveries.filter((d: DbDelivery) => d.status === 'flagged')
  const completedDeliveries = deliveries.filter((d: DbDelivery) => d.status === 'delivered')
  const failedDeliveries = deliveries.filter((d: DbDelivery) => d.status === 'failed_permanent')
  
  // Pending deliveries awaiting claim
  const pendingDeliveries = deliveries
    .filter((d: DbDelivery) => d.status === 'posted')
    .slice(0, 5)

  // Recent activity from notifications
  const recentNotifications = notifications.slice(0, 8)
  
  const handleCallDriver = (phone: string, name: string) => {
    toast.info(`Call ${name}: ${phone}`)
  }

return (
  <div className="space-y-6 overflow-x-hidden">
      {/* Invoice alert banners - appear at the very top, highest priority */}
      {escalatedInvoices.length > 0 && (
        <InvoiceAlertBanner
          tone="critical"
          icon={<AlertOctagon className="w-4 h-4" />}
          title={`${escalatedInvoices.length} invoice${escalatedInvoices.length > 1 ? 's' : ''} escalated — requires attention`}
          subtitle="Automatic reminders have stopped. Resolve manually."
          ctaLabel="Review escalated"
          onClick={() => goToInvoices('escalated')}
        />
      )}

      {overdueInvoices.length > 0 && (
        <InvoiceAlertBanner
          tone="warning"
          icon={<AlertTriangle className="w-4 h-4" />}
          title={`${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's are' : ' is'} overdue`}
          subtitle={`Total unpaid: ${formatCurrency(overdueInvoices.reduce((s, i) => s + i.total, 0))}`}
          ctaLabel="View overdue"
          onClick={() => goToInvoices('overdue')}
        />
      )}

      {draftsWithIssues.length > 0 && (
        <InvoiceAlertBanner
          tone="warning"
          icon={<MailWarning className="w-4 h-4" />}
          title={`${draftsWithIssues.length} draft invoice${draftsWithIssues.length > 1 ? 's have' : ' has'} an email issue`}
          subtitle="Bounced or missing billing email. These will be skipped on auto-send."
          ctaLabel="Fix now"
          onClick={() => goToInvoices('draft')}
        />
      )}

      {isReviewPeriod && (
        <InvoiceAlertBanner
          tone="info"
          icon={<FileText className="w-4 h-4" />}
          title={`${drafts.length} draft invoice${drafts.length > 1 ? 's' : ''} ready for review`}
          subtitle={
            settings.autoSendInvoices
              ? `Auto-send ${daysUntilFirst === 0 ? 'today' : `in ${daysUntilFirst} day${daysUntilFirst !== 1 ? 's' : ''}`}${draftsWithIssues.length > 0 ? ` · ${draftsWithIssues.length} with issues` : ''}`
              : 'Auto-send is off — manually send when ready'
          }
          ctaLabel="Review drafts"
          onClick={() => goToInvoices('draft')}
        />
      )}

      {/* Unclaimed Rush Jobs Warning */}
      {rushDeliveries.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <Zap className="w-4 h-4" />
              Unclaimed Rush Jobs ({rushDeliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rushDeliveries.map((delivery: DbDelivery) => {
                const posted = new Date(delivery.posted_at)
                const now = new Date()
                const minsAgo = Math.floor((now.getTime() - posted.getTime()) / 60000)
                const slaMins = 45
                const remaining = slaMins - minsAgo
                const breached = remaining <= 0
                
                return (
                  <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card)]">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {delivery.business?.name || 'Unknown Business'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.pickup_area} → {delivery.dropoff_area}
                      </p>
                    </div>
                    <div className="text-right">
                      {breached ? (
                        <Badge variant="destructive" className="animate-pulse">
                          SLA BREACHED - {Math.abs(remaining)}m ago
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={remaining < 15 ? 'text-red-400 border-red-400' : 'text-orange-400 border-orange-400'}>
                          {remaining}m remaining
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flagged Deliveries Warning */}
      {flaggedDeliveries.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
              <Flag className="w-4 h-4" />
              Flagged Deliveries ({flaggedDeliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {flaggedDeliveries.slice(0, 3).map((delivery: DbDelivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card)]">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {delivery.business?.name || 'Unknown Business'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Driver: {delivery.driver?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {delivery.driver && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCallDriver(delivery.driver!.phone, delivery.driver!.name)}
                        className="h-8"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Call
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Select a driver to reassign')}
                      className="h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reassign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Deliveries</p>
                <p className="text-2xl font-bold">{stats?.totalDeliveries || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-400">{stats?.completedToday || 0} today</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-bold text-yellow-400">{stats?.activeDeliveries || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.postedDeliveries || 0} awaiting claim
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Drivers</p>
                <p className="text-2xl font-bold text-green-400">{stats?.activeDrivers || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {stats?.totalDrivers || 0} total
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Businesses</p>
                <p className="text-2xl font-bold text-blue-400">{stats?.totalBusinesses || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {businesses.filter(b => b.status === 'active').length} active
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-6">
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold">{completedDeliveries.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold text-red-400">{failedDeliveries.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold text-yellow-400">{stats?.flaggedDeliveries || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Flagged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold">
              {drivers.filter((d: DbDriver) => d.invite_status === 'active').length}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold">
              {drivers.filter((d: DbDriver) => d.status === 'on_delivery').length}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Busy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-base sm:text-lg font-bold">
              {completedDeliveries.length > 0 
                ? ((completedDeliveries.length / (stats?.totalDeliveries || 1)) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Success</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Pending Deliveries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Awaiting Claim
              {pendingDeliveries.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{pendingDeliveries.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No pending deliveries
              </p>
            ) : (
              <div className="space-y-3">
                {pendingDeliveries.map((delivery: DbDelivery) => (
                  <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{delivery.business?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{delivery.pickup_area} → {delivery.dropoff_area}</p>
                    </div>
                    <div className="text-right">
                      {(delivery.is_rush || delivery.is_urgent) && (
                        <Badge variant="destructive" className="text-xs mb-1">Rush</Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(delivery.posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      item.notification_type === 'new_job' ? 'bg-green-400' :
                      item.notification_type === 'flag' ? 'bg-yellow-400' :
                      item.notification_type === 'sla_breach' ? 'bg-red-400' :
                      item.notification_type === 'driver_timeout' ? 'bg-orange-400' :
                      item.notification_type === 'payment_received' ? 'bg-blue-400' :
                      'bg-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  })
}

type BannerTone = 'critical' | 'warning' | 'info'

function InvoiceAlertBanner({
  tone,
  icon,
  title,
  subtitle,
  ctaLabel,
  onClick,
}: {
  tone: BannerTone
  icon: React.ReactNode
  title: string
  subtitle?: string
  ctaLabel: string
  onClick: () => void
}) {
  const palette: Record<BannerTone, { border: string; bg: string; iconColor: string; title: string; cta: string }> = {
    critical: {
      border: 'border-red-500/40',
      bg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      title: 'text-red-300',
      cta: 'bg-red-500 hover:bg-red-500/90 text-white',
    },
    warning: {
      border: 'border-yellow-500/40',
      bg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      title: 'text-yellow-200',
      cta: 'bg-yellow-500 hover:bg-yellow-500/90 text-black',
    },
    info: {
      border: 'border-blue-500/40',
      bg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      title: 'text-blue-200',
      cta: 'bg-blue-500 hover:bg-blue-500/90 text-white',
    },
  }
  const c = palette[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border ${c.border} ${c.bg} p-4 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)]`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--bg-card)] flex items-center justify-center ${c.iconColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${c.title}`}>{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <Badge className={`${c.cta} border-0 hidden sm:inline-flex`}>{ctaLabel}</Badge>
          <ChevronRight className={`w-5 h-5 ${c.iconColor}`} />
        </div>
      </div>
    </button>
  )
}
