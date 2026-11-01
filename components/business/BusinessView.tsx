'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { CreateOrderForm } from './CreateOrderForm'
import { BusinessOrders } from './BusinessOrders'
import { BusinessLiveTracking } from './BusinessLiveTracking'
import { BusinessInvoices } from './BusinessInvoices'
import { BusinessProfile } from './BusinessProfile'
import { BusinessReports } from './BusinessReports'
import { LocationSwitcher } from './LocationSwitcher'
import { BusinessNotificationCenter } from './BusinessNotificationCenter'
import { HelpGuide } from '@/components/shared/HelpGuide'
import { BusinessSidebar } from './shell/BusinessSidebar'
import { BusinessMobileNav } from './shell/BusinessMobileNav'
import {
  ACTIVE_DELIVERY_STATUSES,
  BUSINESS_NAV,
  IN_TRANSIT_STATUSES,
  type BusinessSection,
} from './shell/nav-items'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function greeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

export function BusinessView() {
  const [activeTab, setActiveTab] = useState<BusinessSection>('orders')
  const { currentUser, deliveries, logout } = useApp()

  // Portaled overlays (dialogs, selects, sheets) render on <body>, outside
  // the shell, so the scoped theme must live there too while mounted.
  useEffect(() => {
    document.body.classList.add('business-theme')
    return () => document.body.classList.remove('business-theme')
  }, [])

  const { activeCount, inTransitCount } = useMemo(() => {
    const mine = deliveries.filter(d => d.businessId === currentUser?.businessId)
    return {
      activeCount: mine.filter(d => ACTIVE_DELIVERY_STATUSES.has(d.status)).length,
      inTransitCount: mine.filter(d => IN_TRANSIT_STATUSES.has(d.status)).length,
    }
  }, [deliveries, currentUser?.businessId])

  const navigate = (section: string) => {
    setActiveTab(section as BusinessSection)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const section = BUSINESS_NAV.find(item => item.id === activeTab) ?? BUSINESS_NAV[0]
  const initials = currentUser?.name ? getInitials(currentUser.name) : 'U'
  const firstName = currentUser?.name?.split(' ')[0]
  const now = new Date()
  const isOverview = activeTab === 'orders'

  return (
    <div className="business-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <BusinessSidebar
        active={activeTab}
        onNavigate={navigate}
        activeCount={activeCount}
        inTransitCount={inTransitCount}
        userName={currentUser?.name ?? 'Account'}
        userEmail={currentUser?.email ?? ''}
        initials={initials}
        onLogout={() => {
          void logout()
        }}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl safe-area-top">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <span className="text-base font-bold tracking-tight text-brand">DOMS</span>
              <span className="h-6 w-px bg-border" aria-hidden="true" />
              <LocationSwitcher />
            </div>

            <div className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
              <span className="text-muted-foreground">{section.group}</span>
              <span className="text-muted-foreground/50" aria-hidden="true">
                {'/'}
              </span>
              <span className="font-medium text-foreground">{section.label}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {inTransitCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('live')}
                  className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-colors hover:border-foreground/20 sm:flex"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-route-pulse" aria-hidden="true" />
                  <span className="tabular">{inTransitCount}</span> on the road
                </button>
              )}
              <HelpGuide role="business" />
              <BusinessNotificationCenter />
              {activeTab !== 'create' && (
                <Button size="sm" onClick={() => navigate('create')} className="ml-1 hidden h-9 gap-1.5 rounded-full px-4 lg:inline-flex">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New delivery
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
            <div className="flex flex-col gap-1.5 pb-6 lg:pb-8">
              {isOverview && (
                <span className="text-xs text-muted-foreground">{dateFormatter.format(now)}</span>
              )}
              <h1 className="text-balance text-2xl text-foreground lg:text-[32px] lg:leading-tight">
                {isOverview && firstName ? `${greeting(now)}, ${firstName}` : section.label}
              </h1>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{section.description}</p>
            </div>

            {activeTab === 'orders' && <BusinessOrders onNavigate={navigate} />}
            {activeTab === 'live' && <BusinessLiveTracking />}
            {activeTab === 'create' && <CreateOrderForm onSuccess={() => navigate('orders')} />}
            {activeTab === 'invoices' && <BusinessInvoices />}
            {activeTab === 'reports' && <BusinessReports />}
            {activeTab === 'profile' && <BusinessProfile />}
          </div>
        </main>
      </div>

      <BusinessMobileNav active={activeTab} onNavigate={navigate} />
    </div>
  )
}
