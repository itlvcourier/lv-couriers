'use client'

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Delivery, Driver, Business, UserRole, DeliveryStatus, NewDeliveryData, FailReason } from './types'
import { initialDeliveries, initialDrivers, initialBusinesses } from './data'
import { calculateDuration, generateDeliveryId, getNextStatus } from './delivery-utils'

interface AppContextType {
  // Data
  deliveries: Delivery[]
  drivers: Driver[]
  businesses: Business[]

  // Current user state
  activeRole: UserRole
  currentDriverId: string
  activeBusinessId: string

  // Role switching
  setActiveRole: (role: UserRole) => void
  setCurrentDriverId: (id: string) => void
  setActiveBusinessId: (id: string) => void

  // Delivery actions
  claimDelivery: (deliveryId: string, driverId: string) => void
  advanceStatus: (deliveryId: string) => void
  completeDelivery: (deliveryId: string, photoUrl: string) => void
  failDelivery: (deliveryId: string, reason: FailReason) => void
  postDelivery: (data: NewDeliveryData) => void
  reassignDriver: (deliveryId: string, newDriverId: string) => void

  // Driver actions
  toggleDriverStatus: (driverId: string) => void

  // Activity feed
  activityFeed: ActivityEvent[]
}

export interface ActivityEvent {
  id: string
  driverId: string | null
  driverName: string | null
  driverAvatar: string | null
  businessName: string
  deliveryId: string
  action: string
  status: DeliveryStatus
  timestamp: string
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [businesses] = useState<Business[]>(initialBusinesses)
  const [activeRole, setActiveRole] = useState<UserRole>('driver')
  const [currentDriverId, setCurrentDriverId] = useState<string>('driver-1') // Marcus Reid
  const [activeBusinessId, setActiveBusinessId] = useState<string>('business-1') // FreshMart
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])

  const addActivity = useCallback((
    delivery: Delivery,
    action: string,
    status: DeliveryStatus,
    driver?: Driver | null
  ) => {
    const event: ActivityEvent = {
      id: `activity-${Date.now()}`,
      driverId: driver?.id ?? delivery.driverId,
      driverName: driver?.name ?? delivery.driverName,
      driverAvatar: driver?.avatar ?? null,
      businessName: delivery.businessName,
      deliveryId: delivery.id,
      action,
      status,
      timestamp: new Date().toISOString(),
    }
    setActivityFeed(prev => [event, ...prev].slice(0, 50))
  }, [])

  // TODO: Replace with Supabase query
  const claimDelivery = useCallback((deliveryId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return

    setDeliveries(prev =>
      prev.map(d => {
        if (d.id === deliveryId) {
          const now = new Date().toISOString()
          const updated = {
            ...d,
            driverId,
            driverName: driver.name,
            status: 'claimed' as DeliveryStatus,
            claimedAt: now,
            statusHistory: [
              ...d.statusHistory,
              { status: 'claimed' as DeliveryStatus, timestamp: now, note: null },
            ],
          }
          addActivity(updated, 'claimed', 'claimed', driver)
          return updated
        }
        return d
      })
    )

    // Update driver status
    setDrivers(prev =>
      prev.map(d =>
        d.id === driverId ? { ...d, status: 'on_delivery' as const } : d
      )
    )
  }, [drivers, addActivity])

  // TODO: Replace with Supabase query
  const advanceStatus = useCallback((deliveryId: string) => {
    setDeliveries(prev =>
      prev.map(d => {
        if (d.id === deliveryId) {
          const nextStatus = getNextStatus(d.status)
          if (!nextStatus || nextStatus === 'delivered') return d

          const now = new Date().toISOString()
          const updated = {
            ...d,
            status: nextStatus,
            pickedUpAt: nextStatus === 'picked_up' ? now : d.pickedUpAt,
            statusHistory: [
              ...d.statusHistory,
              { status: nextStatus, timestamp: now, note: null },
            ],
          }
          
          const driver = drivers.find(dr => dr.id === d.driverId)
          addActivity(updated, `marked as ${nextStatus.replace(/_/g, ' ')}`, nextStatus, driver)
          return updated
        }
        return d
      })
    )
  }, [drivers, addActivity])

  // TODO: Replace with Supabase query
  const completeDelivery = useCallback((deliveryId: string, photoUrl: string) => {
    setDeliveries(prev =>
      prev.map(d => {
        if (d.id === deliveryId) {
          const now = new Date().toISOString()
          const duration = d.claimedAt ? calculateDuration(d.claimedAt, now) : null
          const updated = {
            ...d,
            status: 'delivered' as DeliveryStatus,
            deliveredAt: now,
            duration,
            proofPhotoUrl: photoUrl,
            statusHistory: [
              ...d.statusHistory,
              { status: 'delivered' as DeliveryStatus, timestamp: now, note: null },
            ],
          }

          const driver = drivers.find(dr => dr.id === d.driverId)
          addActivity(updated, 'completed delivery', 'delivered', driver)

          // Update driver stats
          if (d.driverId) {
            setDrivers(prevDrivers =>
              prevDrivers.map(dr =>
                dr.id === d.driverId
                  ? {
                      ...dr,
                      status: 'available' as const,
                      totalDeliveries: dr.totalDeliveries + 1,
                      todayDeliveries: dr.todayDeliveries + 1,
                    }
                  : dr
              )
            )
          }

          return updated
        }
        return d
      })
    )
  }, [drivers, addActivity])

  // TODO: Replace with Supabase query
  const failDelivery = useCallback((deliveryId: string, reason: FailReason) => {
    setDeliveries(prev =>
      prev.map(d => {
        if (d.id === deliveryId) {
          const now = new Date().toISOString()
          const updated = {
            ...d,
            status: 'failed' as DeliveryStatus,
            statusHistory: [
              ...d.statusHistory,
              { status: 'failed' as DeliveryStatus, timestamp: now, note: reason },
            ],
          }

          const driver = drivers.find(dr => dr.id === d.driverId)
          addActivity(updated, `marked as failed: ${reason}`, 'failed', driver)

          // Free up driver
          if (d.driverId) {
            setDrivers(prevDrivers =>
              prevDrivers.map(dr =>
                dr.id === d.driverId
                  ? { ...dr, status: 'available' as const }
                  : dr
              )
            )
          }

          return updated
        }
        return d
      })
    )
  }, [drivers, addActivity])

  // TODO: Replace with Supabase query
  const postDelivery = useCallback((data: NewDeliveryData) => {
    const now = new Date().toISOString()
    const newDelivery: Delivery = {
      id: generateDeliveryId(),
      ...data,
      driverId: null,
      driverName: null,
      status: 'posted',
      postedAt: now,
      claimedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      duration: null,
      proofPhotoUrl: null,
      statusHistory: [{ status: 'posted', timestamp: now, note: null }],
    }

    setDeliveries(prev => [newDelivery, ...prev])
    addActivity(newDelivery, 'posted new delivery', 'posted', null)
  }, [addActivity])

  // TODO: Replace with Supabase query
  const reassignDriver = useCallback((deliveryId: string, newDriverId: string) => {
    const newDriver = drivers.find(d => d.id === newDriverId)
    if (!newDriver) return

    setDeliveries(prev =>
      prev.map(d => {
        if (d.id === deliveryId) {
          const oldDriverId = d.driverId

          // Free old driver
          if (oldDriverId) {
            setDrivers(prevDrivers =>
              prevDrivers.map(dr =>
                dr.id === oldDriverId
                  ? { ...dr, status: 'available' as const }
                  : dr
              )
            )
          }

          const updated = {
            ...d,
            driverId: newDriverId,
            driverName: newDriver.name,
          }

          addActivity(updated, `reassigned to ${newDriver.name}`, d.status, newDriver)

          // Set new driver to on_delivery
          setDrivers(prevDrivers =>
            prevDrivers.map(dr =>
              dr.id === newDriverId
                ? { ...dr, status: 'on_delivery' as const }
                : dr
            )
          )

          return updated
        }
        return d
      })
    )
  }, [drivers, addActivity])

  const toggleDriverStatus = useCallback((driverId: string) => {
    setDrivers(prev =>
      prev.map(d => {
        if (d.id === driverId && d.status !== 'on_delivery') {
          return {
            ...d,
            status: d.status === 'available' ? 'off_duty' as const : 'available' as const,
          }
        }
        return d
      })
    )
  }, [])

  const value: AppContextType = {
    deliveries,
    drivers,
    businesses,
    activeRole,
    currentDriverId,
    activeBusinessId,
    setActiveRole,
    setCurrentDriverId,
    setActiveBusinessId,
    claimDelivery,
    advanceStatus,
    completeDelivery,
    failDelivery,
    postDelivery,
    reassignDriver,
    toggleDriverStatus,
    activityFeed,
  }

  return <AppContext value={value}>{children}</AppContext>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
