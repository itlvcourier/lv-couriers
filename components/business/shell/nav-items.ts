import { BarChart3, Building2, Package, Plus, Radar, Receipt, type LucideIcon } from 'lucide-react'

export type BusinessSection = 'orders' | 'live' | 'create' | 'invoices' | 'reports' | 'profile'

export interface BusinessNavItem {
  id: BusinessSection
  label: string
  shortLabel: string
  description: string
  group: 'Operate' | 'Finance' | 'Organization'
  icon: LucideIcon
}

export const BUSINESS_NAV: BusinessNavItem[] = [
  { id: 'orders', label: 'Orders', shortLabel: 'Orders', group: 'Operate', description: 'Every delivery you have booked, with live progress.', icon: Package },
  { id: 'live', label: 'Live tracking', shortLabel: 'Live', group: 'Operate', description: 'Couriers currently moving your packages.', icon: Radar },
  { id: 'create', label: 'New delivery', shortLabel: 'New', group: 'Operate', description: 'Book a pickup and drop-off in under a minute.', icon: Plus },
  { id: 'invoices', label: 'Billing', shortLabel: 'Billing', group: 'Finance', description: 'Invoices, payments and statements.', icon: Receipt },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', group: 'Finance', description: 'Volume, spend and on-time performance.', icon: BarChart3 },
  { id: 'profile', label: 'Account', shortLabel: 'Account', group: 'Organization', description: 'Business details, locations and team.', icon: Building2 },
]

export const NAV_GROUPS: BusinessNavItem['group'][] = ['Operate', 'Finance', 'Organization']

export const ACTIVE_DELIVERY_STATUSES = new Set([
  'posted',
  'claimed',
  'en_route_pickup',
  'picked_up',
  'en_route_dropoff',
  'failed_retry',
])

export const IN_TRANSIT_STATUSES = new Set(['en_route_pickup', 'picked_up', 'en_route_dropoff'])
