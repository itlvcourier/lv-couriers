'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
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
  Menu,
  X,
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
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') poll()
    }, 60_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [activePage])

  // Portaled overlays render on <body>, so the scoped theme lives there too.
  useEffect(() => {
    document.body.classList.add('portal-theme')
    return () => document.body.classList.remove('portal-theme')
  }, [])

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

  const initials = admin?.name ? getInitials(admin.name) : 'A'
  const activeGroup = visibleGroups.find(g => g.items.some(i => i.id === activePage))?.heading ?? 'Operations'

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-brand">DOMS</span>
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Admin
          </span>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Close menu</span>
        </Button>
      </div>

      <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-2">
        {visibleGroups.map(group => (
          <div key={group.heading} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{group.heading}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const isActive = activePage === item.id
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setActivePage(item.id)
                        setSidebarOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'border-border bg-card font-medium text-foreground shadow-[var(--elevation)]'
                          : 'border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.id === 'requests' && pendingRequests > 0 && (
                        <span className="flex items-center gap-1.5 text-xs tabular text-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-route-pulse" aria-hidden="true" />
                          {pendingRequests}
                          <span className="sr-only">pending</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{admin?.name || 'Admin'}</span>
          <span className="truncate text-xs text-muted-foreground">{admin?.email}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void logout()
          }}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="portal-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background lg:flex">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-background">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Open menu</span>
              </Button>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground sm:inline">{activeGroup}</span>
                <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden="true">
                  {'/'}
                </span>
                <h1 className="truncate font-medium text-foreground">{PAGE_LABELS[activePage]}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {pendingRequests > 0 && activePage !== 'requests' && (
                <button
                  type="button"
                  onClick={() => setActivePage('requests')}
                  className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-foreground/20 sm:flex"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-route-pulse" aria-hidden="true" />
                  <span className="tabular">{pendingRequests}</span> awaiting approval
                </button>
              )}
              <HelpGuide role="admin" />
              <NotificationCenter />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
