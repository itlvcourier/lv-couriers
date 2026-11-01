'use client'

import { cn } from '@/lib/utils'
import { BUSINESS_NAV, type BusinessSection } from './nav-items'

interface BusinessMobileNavProps {
  active: BusinessSection
  onNavigate: (section: BusinessSection) => void
}

const MOBILE_ORDER: BusinessSection[] = ['orders', 'live', 'create', 'invoices', 'reports', 'profile', 'settings']

export function BusinessMobileNav({ active, onNavigate }: BusinessMobileNavProps) {
  const items = MOBILE_ORDER.map(id => BUSINESS_NAV.find(item => item.id === id)!)

  return (
    <nav
      aria-label="Business navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-7 px-1">
        {items.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          const isCreate = item.id === 'create'
          return (
            <li key={item.id} className="flex">
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] sm:text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {isCreate ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="relative flex h-8 w-8 items-center justify-center">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {isActive && (
                      <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand" aria-hidden="true" />
                    )}
                  </span>
                )}
                <span className="max-w-full truncate px-0.5">{item.shortLabel}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
