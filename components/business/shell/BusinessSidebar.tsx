'use client'

import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LocationSwitcher } from '../LocationSwitcher'
import { BUSINESS_NAV, NAV_GROUPS, type BusinessSection } from './nav-items'

interface BusinessSidebarProps {
  active: BusinessSection
  onNavigate: (section: BusinessSection) => void
  activeCount: number
  inTransitCount: number
  userName: string
  userEmail: string
  initials: string
  onLogout: () => void
}

export function BusinessSidebar({
  active,
  onNavigate,
  activeCount,
  inTransitCount,
  userName,
  userEmail,
  initials,
  onLogout,
}: BusinessSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="text-lg font-bold tracking-tight text-brand">DOMS</span>
        <span className="text-xs text-muted-foreground">by Atria360</span>
      </div>

      <div className="px-4">
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--elevation)]">
          <LocationSwitcher />
        </div>
      </div>

      <nav aria-label="Business navigation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-6">
        {NAV_GROUPS.map(group => {
          const items = BUSINESS_NAV.filter(item => item.group === group && item.id !== 'create')
          return (
            <div key={group} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{group}</p>
              <ul className="flex flex-col gap-0.5">
                {items.map(item => {
                  const Icon = item.icon
                  const isActive = active === item.id
                  const count = item.id === 'orders' ? activeCount : item.id === 'live' ? inTransitCount : 0
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-border bg-card font-medium text-foreground shadow-[var(--elevation)]'
                            : 'border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {count > 0 && (
                          <span className="flex items-center gap-1.5 text-xs tabular text-muted-foreground">
                            {item.id === 'live' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-route-pulse" aria-hidden="true" />
                            )}
                            {count}
                            <span className="sr-only">{item.id === 'live' ? 'on the road' : 'open'}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{userName}</span>
          <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
