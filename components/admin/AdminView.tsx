'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AdminDashboard } from './AdminDashboard'
import { AdminDrivers } from './AdminDrivers'
import { AdminBusinesses } from './AdminBusinesses'
import { AdminOrders } from './AdminOrders'
import { AdminZones } from './AdminZones'
import { AdminSort } from './AdminSort'
import { AdminTransfers } from './AdminTransfers'
import { AdminRateCards } from './AdminRateCards'
import { AdminInvoices } from './AdminInvoices'
import { AdminSettings } from './AdminSettings'
import { AdminCommunications } from './AdminCommunications'
import { AdminDriverReports } from './AdminDriverReports'
import { AdminAuditLog } from './AdminAuditLog'
import { DispatchBoard } from './DispatchBoard'
import { ApprovalQueue } from './ApprovalQueue'
import { getPendingCount } from '@/lib/dispatch-requests'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { NotificationCenter } from './NotificationCenter'
import { HelpGuide } from '@/components/shared/HelpGuide'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Bell,
  MessageSquare,
  BarChart3,
  Radio,
  ScrollText,
  Inbox,
  Map as MapIcon,
  Boxes,
  ArrowLeftRight,
} from 'lucide-react'

type AdminPage = 'dashboard' | 'dispatch' | 'requests' | 'drivers' | 'businesses' | 'orders' | 'zones' | 'sort' | 'transfers' | 'rate_cards' | 'invoices' | 'communications' | 'reports' | 'audit' | 'settings'

type NavItem = { id: AdminPage; label: string; icon: React.ElementType }

/**
 * Sidebar nav, grouped by what the admin is actually trying to do. A flat list
 * of fifteen items gave no hint that "Hub Sort" and "Transfers" are network
 * plumbing while "Dispatch" and "Requests" are live work, so everything read as
 * equally urgent. Order runs live work -> network -> money -> records.
 */
const navGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Operations',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'dispatch', label: 'Dispatch', icon: Radio },
      { id: 'requests', label: 'Requests', icon: Inbox },
      { id: 'orders', label: 'Orders', icon: Package },
    ],
  },
  {
    heading: 'Network',
    items: [
      { id: 'drivers', label: 'Drivers', icon: Users },
      { id: 'businesses', label: 'Businesses', icon: Building2 },
      { id: 'zones', label: 'Zones', icon: MapIcon },
      { id: 'sort', label: 'Hub Sort', icon: Boxes },
      { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { id: 'rate_cards', label: 'Rate Cards', icon: CreditCard },
      { id: 'invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    heading: 'Records',
    items: [
      { id: 'communications', label: 'Communications', icon: MessageSquare },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'audit', label: 'Audit Log', icon: ScrollText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const PAGE_LABELS: Record<AdminPage, string> = Object.fromEntries(
  navGroups.flatMap(g => g.items.map(i => [i.id, i.label])),
) as Record<AdminPage, string>

export function AdminView() {
  const [activePage, setActivePage] = useState<AdminPage>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingRequests, setPendingRequests] = useState(0)
  const { logout, currentUser } = useApp()
  const zonesEnabled = useFeatureFlag('zones_enabled')
  const consolidationEnabled = useFeatureFlag('consolidation_enabled')
  const transfersEnabled = useFeatureFlag('driver_transfers_enabled')

  // Hide flag-gated pages when their feature is off. Groups that end up empty
  // are dropped so we don't render a heading with nothing under it.
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.id === 'zones') return zonesEnabled
        if (item.id === 'sort') return consolidationEnabled
        if (item.id === 'transfers') return transfersEnabled
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  // If a flag-gated page is open but its flag turns off, fall back to dashboard.
  // This has to run in an effect — calling setActivePage during render triggers
  // a render-phase state update, which React re-renders to resolve.
  useEffect(() => {
    if (
      (!zonesEnabled && activePage === 'zones') ||
      (!consolidationEnabled && activePage === 'sort') ||
      (!transfersEnabled && activePage === 'transfers')
    ) {
      setActivePage('dashboard')
    }
  }, [zonesEnabled, consolidationEnabled, transfersEnabled, activePage])

  // Poll pending request count every 60s. Note: getPendingCount() calls
  // expireStaleRequests() internally — avoid polling too fast to prevent
  // unnecessary DB writes.
  useEffect(() => {
    let active = true
    const poll = () => {
      getPendingCount()
        .then((n) => {
          if (active) setPendingRequests(n)
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 60_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [activePage])

  // Lock body scroll when mobile sidebar is open.
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AdminPage>).detail
      if (detail) setActivePage(detail)
    }
    window.addEventListener('doms:navigate-admin', handler)
    return () => window.removeEventListener('doms:navigate-admin', handler)
  }, [])

  // For admin, just use currentUser info directly
  const admin = currentUser ? { name: currentUser.name, email: currentUser.email, avatar: undefined } : null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AdminDashboard />
      case 'dispatch': return <DispatchBoard />
      case 'requests': return <ApprovalQueue />
      case 'drivers': return <AdminDrivers />
      case 'businesses': return <AdminBusinesses />
      case 'orders': return <AdminOrders />
      case 'zones': return <AdminZones />
      case 'sort': return <AdminSort />
      case 'transfers': return <AdminTransfers />
      case 'rate_cards': return <AdminRateCards />
      case 'invoices': return <AdminInvoices />
      case 'communications': return <AdminCommunications />
      case 'reports': return <AdminDriverReports />
      case 'audit': return <AdminAuditLog />
      case 'settings': return <AdminSettings />
      default: return <AdminDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">DOMS</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto flex flex-col gap-5">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
              {group.items.map((item) => (
                <Button
                  key={item.id}
                  variant={activePage === item.id ? 'secondary' : 'ghost'}
                  aria-current={activePage === item.id ? 'page' : undefined}
                  className={cn(
                    "w-full justify-start gap-3 h-11",
                    activePage === item.id && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                  onClick={() => {
                    setActivePage(item.id)
                    setSidebarOpen(false)
                  }}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.id === 'requests' && pendingRequests > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                      {pendingRequests}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={admin?.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {admin?.name ? getInitials(admin.name) : 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{admin?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground truncate">{admin?.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => { void logout() }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold truncate">{PAGE_LABELS[activePage]}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HelpGuide role="admin" />
            <NotificationCenter />
            <Avatar className="w-9 h-9 lg:hidden">
              <AvatarImage src={admin?.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {admin?.name ? getInitials(admin.name) : 'A'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
          <div className="max-w-full">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}
