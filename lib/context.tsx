'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type {
  MockUser,
  Driver,
  Business,
  Delivery,
  SystemSettings,
  Notification,
  UserRole,
  DeliveryStatus,
  PickupVerification,
  DeliveryFlag,
  FailReason,
  RateCard,
  Invoice,
  Dispute,
  UnmatchedPayment,
  PaymentDetails,
  InvoiceLine,
  SMSLogEntry,
  AdminNotification,
  DriverGPS,
  ActivityFeedItem,
  Trip,
  DriverMonthlyReport,
  TimeoutWarning,
  ManifestItem,
  SavedContact,
} from './types'
import {
  mockUsers,
  initialDrivers,
  initialBusinesses,
  initialDeliveries,
  initialSettings,
  initialRateCards,
  initialInvoices,
  initialDisputes,
  initialUnmatchedPayments,
  initialSMSLog,
  initialAdminNotifications,
  initialDriverGPS,
  initialActivityFeed,
  initialTrips,
  initialDriverReports,
  initialTimeoutWarnings,
} from './data'
import { calculateInvoiceLines, calculateGST, generateInvoiceNumber } from './billing'

interface AppContextType {
  // Auth state
  currentUser: MockUser | null
  activeRole: UserRole | null
  activeLocationId: string | null
  
  // Data state
  deliveries: Delivery[]
  drivers: Driver[]
  businesses: Business[]
  settings: SystemSettings
  notifications: Notification[]
  rateCards: RateCard[]
  invoices: Invoice[]
  disputes: Dispute[]
  unmatchedPayments: UnmatchedPayment[]
  
  // Auth functions
  login: (email: string, password: string) => { success: boolean; role?: UserRole; error?: string }
  logout: () => void
  switchLocation: (locationId: string) => void
  
  // Delivery functions
  claimDelivery: (deliveryId: string, driverId: string) => void
  verifyPickup: (deliveryId: string, verifications: PickupVerification[]) => void
  advanceStatus: (deliveryId: string) => void
  completeDelivery: (deliveryId: string, photoUrl: string, recipientNote: string | null) => void
  failDelivery: (deliveryId: string, reason: FailReason, notes?: string) => void
  flagDelivery: (deliveryId: string, type: DeliveryFlag['type'], note: string, photoUrl: string | null) => void
  resolveFlag: (deliveryId: string, flagId: string, action: 'proceed' | 'cancel' | 'modify') => void
  postDelivery: (data: Partial<Delivery>) => void
  reassignDriver: (deliveryId: string, newDriverId: string) => void
  cancelOrderByBusiness: (deliveryId: string, reason?: string) => { ok: boolean; error?: string }

  // Saved recipients (address book)
  savedContacts: SavedContact[]
  getSavedContactsForBusiness: (businessId: string) => SavedContact[]
  upsertSavedContact: (input: {
    businessId: string
    name: string
    phone?: string | null
    address: string
    area?: string | null
    buzzCode?: string | null
    notes?: string | null
  }) => SavedContact
  deleteSavedContact: (contactId: string) => void
  
  // Driver functions
  toggleDriverStatus: (driverId: string) => void
  deactivateDriver: (driverId: string) => void
  reactivateDriver: (driverId: string) => void
  addDriver: (driver: Omit<Driver, 'id'>) => void
  
  // Business functions
  addBusiness: (business: Omit<Business, 'id'>) => void
  
  // Settings functions
  updateSettings: (settings: Partial<SystemSettings>) => void
  
  // Notification functions
  markNotificationRead: (notificationId: string) => void
  
  // Billing functions
  saveRateCard: (locationId: string, rateCard: Partial<RateCard>) => void
  getRateCardForLocation: (locationId: string) => RateCard | null
  generateInvoice: (businessId: string, locationId: string, periodStart: string, periodEnd: string) => Invoice | null
  markInvoicePaid: (invoiceId: string, paymentDetails: PaymentDetails) => void
  disputeLineItem: (invoiceId: string, lineItemId: string, claim: string, photoUrl: string | null) => void
  resolveDispute: (disputeId: string, action: 'accept' | 'reject', adminNote: string, creditAmount?: number) => void
  matchPayment: (paymentId: string, invoiceId: string) => void
  
  // Phase 3: Tracking & Notifications
  smsLog: SMSLogEntry[]
  adminNotifications: AdminNotification[]
  driverGPS: DriverGPS[]
  activityFeed: ActivityFeedItem[]
  generateTrackingLink: (deliveryId: string) => string
  sendTrackingSMS: (deliveryId: string, recipientPhone: string) => void
  markAdminNotificationRead: (notificationId: string) => void
  markAllAdminNotificationsRead: () => void
  retrySMS: (smsLogId: string) => void
  getDeliveryByTrackingCode: (code: string) => Delivery | null
  
  // Phase 4: Multi-Stop & Advanced
  trips: Trip[]
  driverReports: DriverMonthlyReport[]
  timeoutWarnings: TimeoutWarning[]
  claimMultiple: (deliveryIds: string[], driverId: string) => void
  addJobToTrip: (tripId: string, deliveryId: string) => void
  reorderTrip: (tripId: string, newOrder: string[]) => void
  retryDelivery: (deliveryId: string) => void
  escalateDelivery: (deliveryId: string) => void
  checkDuplicateAddress: (dropoffAddress: string, businessId: string, locationId: string) => Delivery | null
  combineDeliveries: (existingDeliveryId: string, newManifestItems: ManifestItem[]) => void
  dismissTimeout: (timeoutId: string) => void
  updateDriverCapacity: (driverId: string, maxJobs: number | null) => void
  getDriverTrip: (driverId: string) => Trip | null
  
  // Helpers
  getDriverActiveJobs: (driverId: string) => number
  getDriverMaxJobs: (driverId: string) => number
  canDriverClaimJob: (driverId: string) => boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null)
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses)
  const [settings, setSettings] = useState<SystemSettings>(initialSettings)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [rateCards, setRateCards] = useState<RateCard[]>(initialRateCards)
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [disputes, setDisputes] = useState<Dispute[]>(initialDisputes)
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>(initialUnmatchedPayments)
  const [smsLog, setSMSLog] = useState<SMSLogEntry[]>(initialSMSLog)
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>(initialAdminNotifications)
  const [driverGPS, setDriverGPS] = useState<DriverGPS[]>(initialDriverGPS)
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(initialActivityFeed)
  const [trips, setTrips] = useState<Trip[]>(initialTrips)
  const [driverReports] = useState<DriverMonthlyReport[]>(initialDriverReports)
  const [timeoutWarnings, setTimeoutWarnings] = useState<TimeoutWarning[]>(initialTimeoutWarnings)
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])

  // Auth functions
  const login = useCallback((email: string, password: string) => {
    const user = mockUsers.find(u => u.email === email && u.password === password)
    if (!user) {
      return { success: false, error: 'Incorrect email or password. Please try again.' }
    }
    setCurrentUser(user)
    setActiveRole(user.role)
    if (user.locationId) {
      setActiveLocationId(user.locationId)
    }
    return { success: true, role: user.role }
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    setActiveRole(null)
    setActiveLocationId(null)
  }, [])

  const switchLocation = useCallback((locationId: string) => {
    setActiveLocationId(locationId)
  }, [])

  // Helper functions
  const getDriverActiveJobs = useCallback((driverId: string) => {
    return deliveries.filter(
      d => d.driverId === driverId && 
      !['delivered', 'failed_permanent', 'cancelled'].includes(d.status)
    ).length
  }, [deliveries])

  const getDriverMaxJobs = useCallback((driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    return driver?.maxJobsOverride ?? settings.globalMaxJobs
  }, [drivers, settings.globalMaxJobs])

  const canDriverClaimJob = useCallback((driverId: string) => {
    const activeJobs = getDriverActiveJobs(driverId)
    const maxJobs = getDriverMaxJobs(driverId)
    return activeJobs < maxJobs
  }, [getDriverActiveJobs, getDriverMaxJobs])

  // Delivery functions
  const claimDelivery = useCallback((deliveryId: string, driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return

    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          driverId,
          driverName: driver.name,
          status: 'claimed' as DeliveryStatus,
          claimedAt: new Date().toISOString(),
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'claimed' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: `Claimed by ${driver.name}`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [drivers])

  const verifyPickup = useCallback((deliveryId: string, verifications: PickupVerification[]) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        const updatedManifest = d.manifest.map(item => {
          const verification = verifications.find(v => v.itemId === item.id)
          if (verification) {
            return {
              ...item,
              confirmedQty: verification.confirmedQty,
              verificationPhotoUrl: verification.photoUrl,
            }
          }
          return item
        })

        const hasOutOfTown = verifications.some(v => v.outOfTown)

        return {
          ...d,
          manifest: updatedManifest,
          verifications,
          isOutOfTown: hasOutOfTown || d.isOutOfTown,
          status: 'picked_up' as DeliveryStatus,
          pickedUpAt: new Date().toISOString(),
          trackingCode: `LVC-${d.id.split('-')[1]}-${d.driverName?.split(' ').map(n => n[0]).join('') || 'XX'}`,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'picked_up' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: `${verifications.length} items verified`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [])

  const advanceStatus = useCallback((deliveryId: string) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        let newStatus: DeliveryStatus = d.status
        
        switch (d.status) {
          case 'claimed':
            newStatus = 'en_route_pickup'
            break
          case 'en_route_pickup':
            newStatus = 'picked_up'
            break
          case 'picked_up':
            newStatus = 'en_route_dropoff'
            break
        }

        return {
          ...d,
          status: newStatus,
          statusHistory: [
            ...d.statusHistory,
            {
              status: newStatus,
              timestamp: new Date().toISOString(),
              note: null,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [])

  const completeDelivery = useCallback((deliveryId: string, photoUrl: string, recipientNote: string | null) => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        const deliveredAt = new Date().toISOString()
        const pickedUpTime = d.pickedUpAt ? new Date(d.pickedUpAt).getTime() : Date.now()
        const duration = Math.round((Date.now() - pickedUpTime) / 60000)

        return {
          ...d,
          status: 'delivered' as DeliveryStatus,
          deliveredAt,
          duration: `${duration} min`,
          proofPhotoUrl: photoUrl,
          recipientNote,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'delivered' as DeliveryStatus,
              timestamp: deliveredAt,
              note: recipientNote,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))

    // Update driver stats
    if (delivery?.driverId) {
      setDrivers(prev => prev.map(driver => {
        if (driver.id === delivery.driverId) {
          return {
            ...driver,
            totalDeliveries: driver.totalDeliveries + 1,
            todayDeliveries: driver.todayDeliveries + 1,
            monthDeliveries: driver.monthDeliveries + 1,
          }
        }
        return driver
      }))
    }
  }, [deliveries])

  const failDelivery = useCallback((deliveryId: string, reason: FailReason, notes?: string) => {
    const noteText = notes?.trim() ? `${reason} — ${notes.trim()}` : reason
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: 'failed_retry' as DeliveryStatus,
          retryCount: (d.retryCount ?? 0) + 1,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'failed_retry' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: noteText,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [])

  const flagDelivery = useCallback((deliveryId: string, type: DeliveryFlag['type'], note: string, photoUrl: string | null) => {
    const flag: DeliveryFlag = {
      id: `flag-${Date.now()}`,
      type,
      driverNote: note,
      photoUrl,
      status: 'open',
      resolution: null,
      createdAt: new Date().toISOString(),
    }

    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: 'flagged' as DeliveryStatus,
          flags: [...d.flags, flag],
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'flagged' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: `Flagged: ${type}`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))

    // Add notification for admin
    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      type: 'flag',
      title: 'Delivery Flagged',
      message: `Driver flagged delivery: ${type}`,
      deliveryId,
      createdAt: new Date().toISOString(),
      read: false,
    }
    setNotifications(prev => [newNotification, ...prev])
  }, [])

  const resolveFlag = useCallback((deliveryId: string, flagId: string, action: 'proceed' | 'cancel' | 'modify') => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        const updatedFlags = d.flags.map(f => {
          if (f.id === flagId) {
            return { ...f, status: 'resolved' as const, resolution: action }
          }
          return f
        })

        let newStatus: DeliveryStatus = d.status
        if (action === 'proceed') {
          newStatus = 'en_route_pickup'
        } else if (action === 'cancel') {
          newStatus = 'cancelled'
        }

        return {
          ...d,
          flags: updatedFlags,
          status: newStatus,
        }
      }
      return d
    }))
  }, [])

  const postDelivery = useCallback((data: Partial<Delivery>) => {
    const newDelivery: Delivery = {
      id: `del-${Date.now()}`,
      businessId: data.businessId || '',
      locationId: data.locationId || '',
      businessName: data.businessName || '',
      driverId: null,
      driverName: null,
      pickupAddress: data.pickupAddress || '',
      pickupArea: data.pickupArea || '',
      dropoffAddress: data.dropoffAddress || '',
      dropoffArea: data.dropoffArea || '',
      recipientName: data.recipientName || null,
      recipientPhone: data.recipientPhone || null,
      buzzCode: data.buzzCode || null,
      manifest: data.manifest || [],
      isUrgent: data.isUrgent || false,
      isOutOfTown: data.isOutOfTown || false,
      status: 'posted',
      postedAt: new Date().toISOString(),
      claimedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      duration: null,
      proofPhotoUrl: null,
      recipientNote: null,
      calculatedRate: null,
      flags: [],
      verifications: [],
      statusHistory: [
        {
          status: 'posted',
          timestamp: new Date().toISOString(),
          note: null,
          gpsLat: null,
          gpsLng: null,
        },
      ],
      trackingCode: null,
      tripId: null,
      retryCount: 0,
    }

    setDeliveries(prev => [newDelivery, ...prev])
  }, [])

  const reassignDriver = useCallback((deliveryId: string, newDriverId: string) => {
    const newDriver = drivers.find(d => d.id === newDriverId)
    if (!newDriver) return

    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          driverId: newDriverId,
          driverName: newDriver.name,
          statusHistory: [
            ...d.statusHistory,
            {
              status: d.status,
              timestamp: new Date().toISOString(),
              note: `Reassigned to ${newDriver.name}`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [drivers])

  // Business-initiated cancel: only allowed before a driver has claimed the job.
  // Returns { ok, error } instead of throwing so the caller can show a friendly toast.
  const cancelOrderByBusiness = useCallback(
    (deliveryId: string, reason?: string): { ok: boolean; error?: string } => {
      const delivery = deliveries.find(d => d.id === deliveryId)
      if (!delivery) {
        return { ok: false, error: 'Order not found' }
      }
      if (delivery.status !== 'posted') {
        return {
          ok: false,
          error:
            delivery.status === 'cancelled'
              ? 'This order is already cancelled'
              : 'A driver has already claimed this order. Contact dispatch to cancel.',
        }
      }

      const now = new Date().toISOString()
      setDeliveries(prev =>
        prev.map(d =>
          d.id === deliveryId
            ? {
                ...d,
                status: 'cancelled' as DeliveryStatus,
                cancelledAt: now,
                cancellationStage: 'before_depart',
                cancellationFee: 0,
                cancellationReason: reason?.trim() || 'Cancelled by business (before claim)',
                statusHistory: [
                  ...d.statusHistory,
                  {
                    status: 'cancelled' as DeliveryStatus,
                    timestamp: now,
                    note: reason?.trim() || 'Cancelled by business',
                    gpsLat: null,
                    gpsLng: null,
                  },
                ],
              }
            : d,
        ),
      )
      return { ok: true }
    },
    [deliveries],
  )

  // Saved recipients (per-business address book)
  const getSavedContactsForBusiness = useCallback(
    (businessId: string) =>
      savedContacts
        .filter(c => c.businessId === businessId)
        .sort((a, b) => {
          const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
          const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
          if (bTime !== aTime) return bTime - aTime
          return a.name.localeCompare(b.name)
        }),
    [savedContacts],
  )

  const upsertSavedContact = useCallback(
    (input: {
      businessId: string
      name: string
      phone?: string | null
      address: string
      area?: string | null
      buzzCode?: string | null
      notes?: string | null
    }): SavedContact => {
      const now = new Date().toISOString()
      const nameKey = input.name.trim().toLowerCase()
      const addrKey = input.address.trim().toLowerCase()

      // Compute the next contact OUTSIDE the setter to keep the updater pure
      // (React 18 strict mode invokes updaters twice). We look up the existing
      // contact off the current snapshot; a later dispatch of the same name +
      // address will still be deduped by the reducer below.
      const existing = savedContacts.find(
        c =>
          c.businessId === input.businessId &&
          c.name.trim().toLowerCase() === nameKey &&
          c.address.trim().toLowerCase() === addrKey,
      )

      const next: SavedContact = existing
        ? {
            ...existing,
            phone: input.phone ?? existing.phone,
            area: input.area ?? existing.area,
            buzzCode: input.buzzCode ?? existing.buzzCode,
            notes: input.notes ?? existing.notes,
            useCount: existing.useCount + 1,
            lastUsedAt: now,
            updatedAt: now,
          }
        : {
            id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            businessId: input.businessId,
            name: input.name.trim(),
            phone: input.phone?.trim() || null,
            address: input.address.trim(),
            area: input.area?.trim() || null,
            buzzCode: input.buzzCode?.trim() || null,
            notes: input.notes?.trim() || null,
            useCount: 1,
            lastUsedAt: now,
            createdAt: now,
            updatedAt: now,
          }

      setSavedContacts(prev => {
        // Re-check against the freshest state to handle race conditions or
        // strict-mode double-invocation safely.
        const dupe = prev.find(
          c =>
            c.businessId === input.businessId &&
            c.name.trim().toLowerCase() === nameKey &&
            c.address.trim().toLowerCase() === addrKey,
        )
        if (dupe) return prev.map(c => (c.id === dupe.id ? { ...next, id: dupe.id } : c))
        return [next, ...prev]
      })

      return next
    },
    [savedContacts],
  )

  const deleteSavedContact = useCallback((contactId: string) => {
    setSavedContacts(prev => prev.filter(c => c.id !== contactId))
  }, [])

  // Driver functions
  const toggleDriverStatus = useCallback((driverId: string) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        const newStatus = d.status === 'available' ? 'off_duty' : 'available'
        return { ...d, status: newStatus }
      }
      return d
    }))
  }, [])

  const deactivateDriver = useCallback((driverId: string) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        return { ...d, inviteStatus: 'deactivated' }
      }
      return d
    }))

    // Check for active deliveries
    const activeDeliveries = deliveries.filter(
      d => d.driverId === driverId && !['delivered', 'failed_permanent', 'cancelled'].includes(d.status)
    )

    if (activeDeliveries.length > 0) {
      const driver = drivers.find(d => d.id === driverId)
      const newNotification: Notification = {
        id: `notif-${Date.now()}`,
        type: 'deactivation',
        title: 'Driver Deactivated',
        message: `${driver?.name} deactivated with ${activeDeliveries.length} active deliveries`,
        driverId,
        createdAt: new Date().toISOString(),
        read: false,
      }
      setNotifications(prev => [newNotification, ...prev])
    }
  }, [deliveries, drivers])

  const reactivateDriver = useCallback((driverId: string) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        return { ...d, inviteStatus: 'active' }
      }
      return d
    }))
  }, [])

  const addDriver = useCallback((driver: Omit<Driver, 'id'>) => {
    const newDriver: Driver = {
      ...driver,
      id: `driver-${Date.now()}`,
    }
    setDrivers(prev => [...prev, newDriver])
  }, [])

  // Business functions
  const addBusiness = useCallback((business: Omit<Business, 'id'>) => {
    const newBusiness: Business = {
      ...business,
      id: `business-${Date.now()}`,
    }
    setBusinesses(prev => [...prev, newBusiness])
  }, [])

  // Settings functions
  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // Notification functions
  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => {
      if (n.id === notificationId) {
        return { ...n, read: true }
      }
      return n
    }))
  }, [])

  // Billing functions
  const saveRateCard = useCallback((locationId: string, rateCardData: Partial<RateCard>) => {
    setRateCards(prev => {
      const existingIndex = prev.findIndex(rc => rc.locationId === locationId)
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...rateCardData,
          updatedAt: new Date().toISOString(),
        }
        return updated
      } else {
        // Create new
        const business = businesses.flatMap(b => b.locations).find(l => l.id === locationId)
        const newRateCard: RateCard = {
          id: `rc-${Date.now()}`,
          businessId: business?.businessId || '',
          locationId,
          effectiveDate: rateCardData.effectiveDate || new Date().toISOString().split('T')[0],
          rateRegular: rateCardData.rateRegular ?? 9,
          rateBigDouble: rateCardData.rateBigDouble ?? 18,
          rateOotBig: rateCardData.rateOotBig ?? 0,
          rateRush: rateCardData.rateRush ?? 20,
          rateRushOot: rateCardData.rateRushOot ?? 30,
          gstApplicable: rateCardData.gstApplicable ?? true,
          cancelBeforeDepart: rateCardData.cancelBeforeDepart ?? 0,
          cancelEnRoute: rateCardData.cancelEnRoute ?? 5,
          notifyDriverAssigned: rateCardData.notifyDriverAssigned ?? true,
          notifyPickupConfirmed: rateCardData.notifyPickupConfirmed ?? true,
          notifyEnRoute: rateCardData.notifyEnRoute ?? true,
          notifyDelivered: rateCardData.notifyDelivered ?? true,
          notifyFailed: rateCardData.notifyFailed ?? true,
          notifyInvoiceSent: rateCardData.notifyInvoiceSent ?? true,
          notifyPaymentReminder: rateCardData.notifyPaymentReminder ?? true,
          notifyRecipientSms: rateCardData.notifyRecipientSms ?? true,
          billingEmail: rateCardData.billingEmail || '',
          backupEmail: rateCardData.backupEmail || '',
          contractNotes: rateCardData.contractNotes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return [...prev, newRateCard]
      }
    })
  }, [businesses])

  const getRateCardForLocation = useCallback((locationId: string): RateCard | null => {
    return rateCards.find(rc => rc.locationId === locationId) || null
  }, [rateCards])

  const generateInvoice = useCallback((
    businessId: string,
    locationId: string,
    periodStart: string,
    periodEnd: string
  ): Invoice | null => {
    const rateCard = rateCards.find(rc => rc.locationId === locationId)
    if (!rateCard) return null

    const business = businesses.find(b => b.id === businessId)
    const location = business?.locations.find(l => l.id === locationId)
    if (!business || !location) return null

    // Get deliveries for this location in the period
    const periodDeliveries = deliveries.filter(d => 
      d.locationId === locationId &&
      d.status === 'delivered' &&
      d.deliveredAt &&
      d.deliveredAt >= periodStart &&
      d.deliveredAt <= periodEnd
    )

    const lines = calculateInvoiceLines(periodDeliveries, rateCard)
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
    const gstAmount = calculateGST(subtotal, rateCard.gstApplicable)
    const total = subtotal + gstAmount

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (settings.invoiceDueDays || 15))

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: generateInvoiceNumber(invoices),
      businessId,
      businessName: business.name,
      locationId,
      locationName: location.name,
      locationAddress: location.address,
      billingEmail: rateCard.billingEmail,
      periodStart,
      periodEnd,
      lines,
      subtotal,
      gstAmount,
      total,
      status: 'draft',
      dueDate: dueDate.toISOString().split('T')[0],
      paidDate: null,
      paymentMethod: null,
      paymentReference: null,
      amountReceived: null,
      emailLog: [
        {
          id: `e-${Date.now()}`,
          type: 'generated',
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setInvoices(prev => [...prev, newInvoice])
    return newInvoice
  }, [rateCards, businesses, deliveries, invoices])

  const markInvoicePaid = useCallback((invoiceId: string, paymentDetails: PaymentDetails) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'paid' as const,
          paidDate: paymentDetails.date,
          paymentMethod: paymentDetails.method,
          paymentReference: paymentDetails.reference,
          amountReceived: paymentDetails.amountReceived,
          updatedAt: new Date().toISOString(),
          emailLog: [
            ...inv.emailLog,
            {
              id: `e-${Date.now()}`,
              type: 'sent' as const,
              timestamp: new Date().toISOString(),
              note: `Marked as paid via ${paymentDetails.method}`,
            },
          ],
        }
      }
      return inv
    }))
  }, [])

  const disputeLineItem = useCallback((
    invoiceId: string,
    lineItemId: string,
    claim: string,
    photoUrl: string | null
  ) => {
    const invoice = invoices.find(i => i.id === invoiceId)
    if (!invoice) return

    const lineItem = invoice.lines.find(l => l.id === lineItemId)
    if (!lineItem) return

    const newDispute: Dispute = {
      id: `dispute-${Date.now()}`,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      lineItemId,
      lineItemDescription: lineItem.description,
      businessId: invoice.businessId,
      businessName: invoice.businessName,
      claim,
      photoUrl,
      status: 'open',
      adminResponse: null,
      creditAmount: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    }

    setDisputes(prev => [...prev, newDispute])

    // Update invoice status
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invoiceId) {
        return { ...inv, status: 'disputed' as const, updatedAt: new Date().toISOString() }
      }
      return inv
    }))

    // Add notification
    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      type: 'flag',
      title: 'Invoice Disputed',
      message: `${invoice.businessName} disputed a charge on ${invoice.invoiceNumber}`,
      businessId: invoice.businessId,
      createdAt: new Date().toISOString(),
      read: false,
    }
    setNotifications(prev => [newNotification, ...prev])
  }, [invoices])

  const resolveDispute = useCallback((
    disputeId: string,
    action: 'accept' | 'reject',
    adminNote: string,
    creditAmount?: number
  ) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId) {
        return {
          ...d,
          status: action === 'accept' ? 'resolved_accepted' as const : 'resolved_rejected' as const,
          adminResponse: adminNote,
          creditAmount: action === 'accept' ? creditAmount || 0 : null,
          resolvedAt: new Date().toISOString(),
        }
      }
      return d
    }))

    // If accepted, update invoice status back to sent (reminders can resume)
    const dispute = disputes.find(d => d.id === disputeId)
    if (dispute) {
      setInvoices(prev => prev.map(inv => {
        if (inv.id === dispute.invoiceId) {
          return {
            ...inv,
            status: 'sent' as const,
            updatedAt: new Date().toISOString(),
          }
        }
        return inv
      }))
    }
  }, [disputes])

  const matchPayment = useCallback((paymentId: string, invoiceId: string) => {
    setUnmatchedPayments(prev => prev.map(p => {
      if (p.id === paymentId) {
        return {
          ...p,
          matchedInvoiceId: invoiceId,
          matchedAt: new Date().toISOString(),
        }
      }
      return p
    }))

    // Mark invoice as paid
    const payment = unmatchedPayments.find(p => p.id === paymentId)
    if (payment) {
      markInvoicePaid(invoiceId, {
        method: 'e_transfer',
        date: payment.dateReceived,
        reference: payment.senderReference,
        amountReceived: payment.amount,
      })
    }
  }, [unmatchedPayments, markInvoicePaid])

  // Phase 3: Tracking & Notification functions
  const generateTrackingLink = useCallback((deliveryId: string): string => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    if (delivery?.trackingCode) {
      return delivery.trackingCode
    }
    // Generate a new tracking code
    const code = `LVC-${deliveryId.split('-')[1]}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return { ...d, trackingCode: code }
      }
      return d
    }))
    return code
  }, [deliveries])

  const sendTrackingSMS = useCallback((deliveryId: string, recipientPhone: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    if (!delivery) return

    const trackingCode = delivery.trackingCode || generateTrackingLink(deliveryId)
    
    const newSMS: SMSLogEntry = {
      id: `sms-${Date.now()}`,
      deliveryId,
      invoiceId: null,
      recipientName: 'Recipient',
      recipientPhone,
      type: 'tracking_link',
      message: `Your LV Courier delivery is on the way! Track: lvcourier.ca/track/${trackingCode}`,
      status: 'sent',
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      errorMessage: null,
    }
    
    setSMSLog(prev => [newSMS, ...prev])

    // Add to activity feed
    const feedItem: ActivityFeedItem = {
      id: `feed-${Date.now()}`,
      type: 'sms_sent',
      message: `Tracking SMS sent to ${recipientPhone}`,
      icon: 'smartphone',
      deliveryId,
      driverId: null,
      businessId: null,
      timestamp: new Date().toISOString(),
    }
    setActivityFeed(prev => [feedItem, ...prev])
  }, [deliveries, generateTrackingLink])

  const markAdminNotificationRead = useCallback((notificationId: string) => {
    setAdminNotifications(prev => prev.map(n => {
      if (n.id === notificationId) {
        return { ...n, read: true }
      }
      return n
    }))
  }, [])

  const markAllAdminNotificationsRead = useCallback(() => {
    setAdminNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const retrySMS = useCallback((smsLogId: string) => {
    setSMSLog(prev => prev.map(sms => {
      if (sms.id === smsLogId) {
        return {
          ...sms,
          status: 'sent' as const,
          sentAt: new Date().toISOString(),
          errorMessage: null,
        }
      }
      return sms
    }))
  }, [])

  const getDeliveryByTrackingCode = useCallback((code: string): Delivery | null => {
    return deliveries.find(d => d.trackingCode === code) || null
  }, [deliveries])

  // Phase 4: Multi-Stop & Advanced functions
  const claimMultiple = useCallback((deliveryIds: string[], driverId: string) => {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return

    // Create a new trip
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      driverId,
      deliveryIds,
      status: 'active',
      startedAt: new Date().toISOString(),
      completedAt: null,
      order: deliveryIds,
    }

    setTrips(prev => [...prev, newTrip])

    // Claim all deliveries
    setDeliveries(prev => prev.map(d => {
      if (deliveryIds.includes(d.id)) {
        return {
          ...d,
          driverId,
          driverName: driver.name,
          status: 'claimed' as DeliveryStatus,
          claimedAt: new Date().toISOString(),
          tripId: newTrip.id,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'claimed' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: `Claimed by ${driver.name} (multi-stop trip)`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [drivers])

  const addJobToTrip = useCallback((tripId: string, deliveryId: string) => {
    const trip = trips.find(t => t.id === tripId)
    if (!trip) return

    const driver = drivers.find(d => d.id === trip.driverId)
    if (!driver) return

    setTrips(prev => prev.map(t => {
      if (t.id === tripId) {
        return {
          ...t,
          deliveryIds: [...t.deliveryIds, deliveryId],
          order: [...t.order, deliveryId],
        }
      }
      return t
    }))

    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          driverId: trip.driverId,
          driverName: driver.name,
          status: 'claimed' as DeliveryStatus,
          claimedAt: new Date().toISOString(),
          tripId,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'claimed' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: `Added to trip by ${driver.name}`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [trips, drivers])

  const reorderTrip = useCallback((tripId: string, newOrder: string[]) => {
    setTrips(prev => prev.map(t => {
      if (t.id === tripId) {
        return { ...t, order: newOrder }
      }
      return t
    }))
  }, [])

  const retryDelivery = useCallback((deliveryId: string) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: 'claimed' as DeliveryStatus,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'claimed' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: 'Retry initiated',
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))
  }, [])

  const escalateDelivery = useCallback((deliveryId: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: 'failed_permanent' as DeliveryStatus,
          driverId: null,
          driverName: null,
          tripId: null,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'failed_permanent' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: 'Escalated after 2 failed attempts',
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))

    // Remove from trip if in one
    if (delivery?.tripId) {
      setTrips(prev => prev.map(t => {
        if (t.id === delivery.tripId) {
          return {
            ...t,
            deliveryIds: t.deliveryIds.filter(id => id !== deliveryId),
            order: t.order.filter(id => id !== deliveryId),
          }
        }
        return t
      }))
    }

    // Add admin notification
    const newNotification: AdminNotification = {
      id: `notif-${Date.now()}`,
      type: 'flag',
      title: 'Delivery Escalated',
      message: `Delivery #${deliveryId.split('-')[1]} - 2 failed attempts - action required`,
      deliveryId,
      driverId: delivery?.driverId || null,
      businessId: delivery?.businessId || null,
      invoiceId: null,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'high',
    }
    setAdminNotifications(prev => [newNotification, ...prev])
  }, [deliveries])

  const checkDuplicateAddress = useCallback((dropoffAddress: string, businessId: string, locationId: string): Delivery | null => {
    const today = new Date().toISOString().split('T')[0]
    return deliveries.find(d => 
      d.dropoffAddress === dropoffAddress &&
      d.businessId === businessId &&
      d.locationId === locationId &&
      d.postedAt.startsWith(today) &&
      ['posted', 'claimed'].includes(d.status)
    ) || null
  }, [deliveries])

  const combineDeliveries = useCallback((existingDeliveryId: string, newManifestItems: ManifestItem[]) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === existingDeliveryId) {
        return {
          ...d,
          manifest: [...d.manifest, ...newManifestItems],
          statusHistory: [
            ...d.statusHistory,
            {
              status: d.status,
              timestamp: new Date().toISOString(),
              note: `${newManifestItems.length} items added to delivery`,
              gpsLat: null,
              gpsLng: null,
            },
          ],
        }
      }
      return d
    }))

    // Notify driver if assigned
    const delivery = deliveries.find(d => d.id === existingDeliveryId)
    if (delivery?.driverId) {
      const feedItem: ActivityFeedItem = {
        id: `feed-${Date.now()}`,
        type: 'status_change',
        message: `Items added to delivery for ${delivery.businessName}`,
        icon: 'package',
        deliveryId: existingDeliveryId,
        driverId: delivery.driverId,
        businessId: delivery.businessId,
        timestamp: new Date().toISOString(),
      }
      setActivityFeed(prev => [feedItem, ...prev])
    }
  }, [deliveries])

  const dismissTimeout = useCallback((timeoutId: string) => {
    setTimeoutWarnings(prev => prev.map(t => {
      if (t.id === timeoutId) {
        return { ...t, dismissed: true }
      }
      return t
    }))
  }, [])

  const updateDriverCapacity = useCallback((driverId: string, maxJobs: number | null) => {
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        return { ...d, maxJobsOverride: maxJobs }
      }
      return d
    }))
  }, [])

  const getDriverTrip = useCallback((driverId: string): Trip | null => {
    return trips.find(t => t.driverId === driverId && t.status === 'active') || null
  }, [trips])

  return (
    <AppContext.Provider
      value={{
        currentUser,
        activeRole,
        activeLocationId,
        deliveries,
        drivers,
        businesses,
        settings,
        notifications,
        login,
        logout,
        switchLocation,
        claimDelivery,
        verifyPickup,
        advanceStatus,
        completeDelivery,
        failDelivery,
        flagDelivery,
        resolveFlag,
        postDelivery,
        reassignDriver,
        cancelOrderByBusiness,
        savedContacts,
        getSavedContactsForBusiness,
        upsertSavedContact,
        deleteSavedContact,
        toggleDriverStatus,
        deactivateDriver,
        reactivateDriver,
        addDriver,
        addBusiness,
        updateSettings,
        markNotificationRead,
        rateCards,
        invoices,
        disputes,
        unmatchedPayments,
        saveRateCard,
        getRateCardForLocation,
        generateInvoice,
        markInvoicePaid,
        disputeLineItem,
        resolveDispute,
        matchPayment,
        smsLog,
        adminNotifications,
        driverGPS,
        activityFeed,
        generateTrackingLink,
        sendTrackingSMS,
        markAdminNotificationRead,
        markAllAdminNotificationsRead,
        retrySMS,
        getDeliveryByTrackingCode,
        trips,
        driverReports,
        timeoutWarnings,
        claimMultiple,
        addJobToTrip,
        reorderTrip,
        retryDelivery,
        escalateDelivery,
        checkDuplicateAddress,
        combineDeliveries,
        dismissTimeout,
        updateDriverCapacity,
        getDriverTrip,
        getDriverActiveJobs,
        getDriverMaxJobs,
        canDriverClaimJob,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
