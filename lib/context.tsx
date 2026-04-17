'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type {
  MockUser,
  Driver,
  Business,
  BusinessLocation,
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
  InvoiceEmailEvent,
  Dispute,
  UnmatchedPayment,
  PaymentDetails,
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
import { calculateInvoiceLines, calculateGST, generateInvoiceNumber, DEFAULT_RATE_CARD_VALUES } from './billing'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  loadAllBusinesses,
  loadAllDrivers,
  loadAllRateCards,
  loadSettings,
  loadDeliveries,
  loadInvoices,
  createDeliveryInDb,
  updateDeliveryFields,
  applyPickupVerifications,
  insertDeliveryFlag,
  insertFailureAndFinalize,
  cancelDeliveryInDb,
  saveRateCardToDb,
  saveSettingsToDb,
  saveBusinessToDb,
  saveLocationToDb,
  updateDriverRow,
  createDriverInDb,
  // Turn 2 helpers (aliased to avoid name clash with the context's own
  // upsertSavedContact/deleteSavedContact callbacks exposed to consumers).
  loadSavedContacts,
  upsertSavedContact as upsertSavedContactInDb,
  deleteSavedContactRow,
  loadAdminNotifications,
  insertAdminNotification,
  markAdminNotificationReadInDb,
  loadSMSLog,
  insertSMSLog,
  markSMSRetriedInDb,
  loadDisputes,
  insertDispute,
  resolveDisputeInDb,
  updateInvoiceStatusOnly,
} from './db-extended'

// Default settings used before system_settings has been loaded from the DB.
const DEFAULT_SETTINGS: SystemSettings = {
  globalMaxJobs: 3,
  rushSlaMins: 45,
  intownTimeoutMins: 90,
  outOfTownTimeoutMins: 150,
  autoGenerateInvoices: true,
  invoiceDueDays: 15,
  autoSendInvoices: false,
  reminderDay1: 7,
  overdueDay: 7,
  escalationDay: 14,
  reviewReminderDays: 2,
  sendReminderEmail: true,
  sendReminderSms: false,
  cancellationBeforeDepart: 0,
  cancellationEnRoute: 5,
}

// Fire-and-forget DB persistence. Logs errors so we can diagnose without
// blocking the optimistic UI update.
function persist<T>(promise: Promise<T>, label: string): void {
  promise.catch(err => {
    // eslint-disable-next-line no-console
    console.error(`[db] ${label} failed:`, err?.message || err)
  })
}

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
  login: (email: string, password: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>
  logout: () => Promise<void>
  // True while we're waiting for Supabase session check + initial data load.
  isHydrating: boolean
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
  addBusiness: (business: Omit<Business, 'id'>) => Business
  addLocation: (businessId: string, location: Omit<BusinessLocation, 'id' | 'businessId'>) => BusinessLocation | null
  
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
  // Invoice sending / reminders
  toggleAutoSend: () => void
  updateInvoiceSettings: (settings: Partial<SystemSettings>) => void
  sendSingleInvoice: (invoiceId: string, opts?: { backupEmail?: string }) => { ok: boolean; reason?: string }
  sendAllDraftInvoices: () => { sent: Invoice[]; skipped: Invoice[] }
  pauseReminders: (invoiceId: string) => void
  resumeReminders: (invoiceId: string) => void
  skipNextReminder: (invoiceId: string) => void
  updateInvoiceBillingEmail: (invoiceId: string, email: string) => void
  updateInvoiceBackupEmail: (invoiceId: string, email: string) => void
  resendBouncedInvoice: (invoiceId: string, newEmail: string) => void
  
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
  const [isHydrating, setIsHydrating] = useState<boolean>(true)
  // Core entities are loaded from Supabase on login and refreshed on mutations.
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  // In-memory state: starts empty on every session. These aren't persisted yet.
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>([])
  const [smsLog, setSMSLog] = useState<SMSLogEntry[]>([])
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([])
  const [driverGPS, setDriverGPS] = useState<DriverGPS[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [driverReports] = useState<DriverMonthlyReport[]>([])
  const [timeoutWarnings, setTimeoutWarnings] = useState<TimeoutWarning[]>([])
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([])

  // -------------------------------------------------------------------------
  // Hydration: fetch the profile + all core entities after a Supabase session
  // exists. Runs on mount (for page refreshes where a session cookie persists)
  // and whenever login/logout change the user.
  // -------------------------------------------------------------------------
  const hydrateFromDb = useCallback(async (user: MockUser) => {
    try {
      const profile = {
        role: user.role,
        businessId: user.businessId || null,
        driverId: user.driverId || null,
      }
      const [b, d, rc, s, dl, inv] = await Promise.all([
        loadAllBusinesses().catch(() => [] as Business[]),
        loadAllDrivers().catch(() => [] as Driver[]),
        loadAllRateCards().catch(() => [] as RateCard[]),
        loadSettings().catch(() => DEFAULT_SETTINGS),
        loadDeliveries(profile).catch(() => [] as Delivery[]),
        loadInvoices(profile).catch(() => [] as Invoice[]),
      ])
      // Backfill businessName on deliveries using the businesses we loaded.
      const byBizId = new Map(b.map(biz => [biz.id, biz.name]))
      setBusinesses(b)
      setDrivers(d)
      setRateCards(rc)
      setSettings(s)
      setDeliveries(dl.map(x => (x.businessName ? x : { ...x, businessName: byBizId.get(x.businessId) || '' })))
      setInvoices(inv)

      // Turn 2 entities: saved contacts, admin notifications, SMS log, disputes.
      // These depend on the data we just loaded (disputes need invoices for
      // enrichment), so we run them in a second parallel batch.
      const [contacts, notifs, sms, disputesLoaded] = await Promise.all([
        loadSavedContacts(profile).catch(() => [] as SavedContact[]),
        loadAdminNotifications(profile).catch(() => [] as AdminNotification[]),
        loadSMSLog(profile).catch(() => [] as SMSLogEntry[]),
        loadDisputes(inv).catch(() => [] as Dispute[]),
      ])
      setSavedContacts(contacts)
      setAdminNotifications(notifs)
      setSMSLog(sms)
      setDisputes(disputesLoaded)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[db] hydration failed', err)
    }
  }, [])

  // Build an app-level user object from a Supabase auth user. All role +
  // linkage info lives in raw_user_meta_data (set when the account was
  // created), so we can resolve everything without hitting a RLS-protected
  // table — which matters because the session cookie doesn't reliably
  // persist across PostgREST calls in the v0 preview sandbox.
  const mockUserFromAuthUser = useCallback((authUser: {
    id: string
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  }): MockUser | null => {
    const meta = (authUser.user_metadata || {}) as Record<string, string>
    const role = meta.role as UserRole | undefined
    if (!role || !['admin', 'driver', 'business'].includes(role)) return null
    return {
      email: authUser.email || '',
      password: '',
      role,
      name: meta.full_name || authUser.email || '',
      businessId: meta.business_id || undefined,
      locationId: meta.location_id || undefined,
      driverId: meta.driver_id || undefined,
    }
  }, [])

  // Check for an existing Supabase session on mount (page refresh).
  useEffect(() => {
    const supabase = createSupabaseClient()
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) {
          if (!cancelled) setIsHydrating(false)
          return
        }
        const restored = mockUserFromAuthUser(authUser)
        if (!restored) {
          setIsHydrating(false)
          return
        }
        setCurrentUser(restored)
        setActiveRole(restored.role)
        if (restored.locationId) setActiveLocationId(restored.locationId)
        await hydrateFromDb(restored)
      } finally {
        if (!cancelled) setIsHydrating(false)
      }
    })()
    return () => { cancelled = true }
  }, [hydrateFromDb, mockUserFromAuthUser])

  // Auth functions — real Supabase Auth.
  const login = useCallback(async (email: string, password: string) => {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      return { success: false, error: 'Incorrect email or password. Please try again.' }
    }
    // Read role + linkage from user_metadata (populated at account creation),
    // so login succeeds even if the session cookie hasn't fully persisted yet.
    const user = mockUserFromAuthUser(data.user)
    if (!user) {
      return { success: false, error: 'Account is missing a role assignment. Contact admin.' }
    }
    setCurrentUser(user)
    setActiveRole(user.role)
    if (user.locationId) setActiveLocationId(user.locationId)
    await hydrateFromDb(user)
    return { success: true, role: user.role }
  }, [hydrateFromDb, mockUserFromAuthUser])

  const logout = useCallback(async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    setCurrentUser(null)
    setActiveRole(null)
    setActiveLocationId(null)
    // Clear cached data so the next sign-in starts fresh.
    setDeliveries([])
    setDrivers([])
    setBusinesses([])
    setRateCards([])
    setInvoices([])
    setNotifications([])
    // Turn 2 entities
    setSavedContacts([])
    setAdminNotifications([])
    setSMSLog([])
    setDisputes([])
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

    persist(
      updateDeliveryFields(deliveryId, {
        driver_id: driverId,
        status: 'claimed',
        claimed_at: new Date().toISOString(),
      }),
      'claimDelivery',
    )

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
    // Persist the verified qty + rate to the DB. Rate calculation happens
    // server-side via the existing billing trigger when we update the row.
    const delivery = deliveries.find(d => d.id === deliveryId)
    const rateCardForLoc = delivery ? rateCards.find(rc => rc.locationId === delivery.locationId) : null
    persist(
      applyPickupVerifications(
        deliveryId,
        verifications,
        delivery?.calculatedRate || 0,
        delivery?.gstAmount || 0,
        delivery?.totalAmount || 0,
        rateCardForLoc?.id || null,
      ),
      'verifyPickup',
    )

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
    // Compute next status outside the updater so we can persist it.
    const current = deliveries.find(d => d.id === deliveryId)
    if (current) {
      const nextStatusMap: Record<string, DeliveryStatus> = {
        claimed: 'en_route_pickup',
        en_route_pickup: 'picked_up',
        picked_up: 'en_route_dropoff',
      }
      const next = nextStatusMap[current.status]
      if (next) persist(updateDeliveryFields(deliveryId, { status: next }), 'advanceStatus')
    }

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
  }, [deliveries])

  const completeDelivery = useCallback((deliveryId: string, photoUrl: string, recipientNote: string | null) => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    const now = new Date()
    const pickedUpAt = delivery?.pickedUpAt ? new Date(delivery.pickedUpAt) : null
    const durationMins = pickedUpAt ? Math.round((now.getTime() - pickedUpAt.getTime()) / 60000) : null
    persist(
      updateDeliveryFields(deliveryId, {
        status: 'delivered',
        delivered_at: now.toISOString(),
        duration_mins: durationMins,
        proof_photo_url: photoUrl,
        recipient_note: recipientNote,
      }),
      'completeDelivery',
    )
    if (delivery?.driverId) {
      const drv = drivers.find(dr => dr.id === delivery.driverId)
      persist(
        updateDriverRow(delivery.driverId, {
          total_deliveries: (drv?.totalDeliveries ?? 0) + 1,
          today_deliveries: (drv?.todayDeliveries ?? 0) + 1,
          month_deliveries: (drv?.monthDeliveries ?? 0) + 1,
          updated_at: new Date().toISOString(),
        }),
        'incrementDriverStats',
      )
    }

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
    const current = deliveries.find(d => d.id === deliveryId)
    const retriesSoFar = current?.retryCount ?? 0
    persist(
      insertFailureAndFinalize(deliveryId, reason, notes, retriesSoFar + 1 >= 3),
      'failDelivery',
    )
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
  }, [deliveries])

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

    persist(
      insertDeliveryFlag({ deliveryId, type, description: note, photoUrl }),
      'flagDelivery',
    )

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
    // Write to DB first so the app has a real UUID + the row survives refresh.
    // We do it async but don't block — once created, we refresh the row into state.
    const businessId = data.businessId || ''
    const locationId = data.locationId || ''
    if (!businessId || !locationId) {
      // eslint-disable-next-line no-console
      console.error('[db] postDelivery missing businessId/locationId')
      return
    }
    persist(
      createDeliveryInDb({
        businessId,
        locationId,
        pickupAddress: data.pickupAddress || '',
        pickupArea: data.pickupArea || '',
        dropoffAddress: data.dropoffAddress || '',
        dropoffArea: data.dropoffArea || '',
        recipientName: data.recipientName ?? null,
        recipientPhone: data.recipientPhone ?? null,
        recipientNote: data.recipientNote ?? null,
        buzzCode: data.buzzCode ?? null,
        isRush: data.isRush ?? false,
        isUrgent: data.isUrgent ?? false,
        isOutOfTown: data.isOutOfTown ?? false,
        manifest: (data.manifest || []).map(m => ({
          type: m.type,
          quantity: m.postedQty,
          notes: m.notes || undefined,
        })),
      }).then(saved => {
        // Attach businessName from our local state for display convenience.
        setDeliveries(prev => {
          // Dedupe: if somehow this ID was already added locally, replace it.
          const withoutDupe = prev.filter(d => d.id !== saved.id)
          const bName = businesses.find(b => b.id === saved.businessId)?.name || ''
          return [{ ...saved, businessName: bName }, ...withoutDupe]
        })
      }),
      'postDelivery',
    )
  }, [businesses])

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
      persist(
        cancelDeliveryInDb(
          deliveryId,
          'before_depart',
          0,
          reason?.trim() || 'Cancelled by business (before claim)',
        ),
        'cancelOrderByBusiness',
      )
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

      // Persist to DB. On create, swap the optimistic client id with the real
      // UUID Postgres assigns so future updates target the right row.
      persist(
        upsertSavedContactInDb(next).then(saved => {
          if (saved.id !== next.id) {
            setSavedContacts(prev => prev.map(c => (c.id === next.id ? saved : c)))
          }
        }),
        'upsertSavedContact',
      )

      return next
    },
    [savedContacts],
  )

  const deleteSavedContact = useCallback((contactId: string) => {
    setSavedContacts(prev => prev.filter(c => c.id !== contactId))
    persist(deleteSavedContactRow(contactId), 'deleteSavedContact')
  }, [])

  // Driver functions
  const toggleDriverStatus = useCallback((driverId: string) => {
    setDrivers(prev => {
      const next = prev.map(d => {
        if (d.id === driverId) {
          const newStatus = d.status === 'available' ? 'off_duty' : 'available'
          persist(updateDriverRow(driverId, { status: newStatus }), 'toggleDriverStatus')
          return { ...d, status: newStatus as Driver['status'] }
        }
        return d
      })
      return next
    })
  }, [])

  const deactivateDriver = useCallback((driverId: string) => {
    persist(updateDriverRow(driverId, { invite_status: 'deactivated' }), 'deactivateDriver')
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
    persist(updateDriverRow(driverId, { invite_status: 'active' }), 'reactivateDriver')
    setDrivers(prev => prev.map(d => {
      if (d.id === driverId) {
        return { ...d, inviteStatus: 'active' }
      }
      return d
    }))
  }, [])

  const addDriver = useCallback((driver: Omit<Driver, 'id'>) => {
    // Insert to DB, get the real UUID back, then append to local state.
    persist(
      createDriverInDb(driver).then(saved => setDrivers(prev => [...prev, saved])),
      'addDriver',
    )
  }, [])

  // ---- Rate-card seeding helper (shared by addBusiness + addLocation + saveRateCard) ----
  const buildDefaultRateCard = useCallback(
    (businessId: string, locationId: string, overrides: Partial<RateCard> = {}): RateCard => {
      const now = new Date().toISOString()
      return {
        id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        businessId,
        locationId,
        effectiveDate: overrides.effectiveDate || now.split('T')[0],
        ...DEFAULT_RATE_CARD_VALUES,
        billingEmail: '',
        backupEmail: '',
        contractNotes: '',
        createdAt: now,
        updatedAt: now,
        ...overrides,
      }
    },
    [],
  )

  // Business functions
  //
  // Every new business gets a default rate card for EACH of its locations so
  // the posting form, estimates, and invoices always have billing data to use.
  // Admins can still override any card later in Admin > Rate Cards.
  const addBusiness = useCallback((business: Omit<Business, 'id'>): Business => {
    // Use a browser-generated UUID so we can link locations immediately.
    const businessId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `business-${Date.now()}`
    // Ensure every location has a real UUID before persisting.
    const locationsWithIds: BusinessLocation[] = (business.locations || []).map(loc => ({
      ...loc,
      businessId,
      id: loc.id && loc.id.length >= 16 ? loc.id : (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    }))
    const newBusiness: Business = { ...business, id: businessId, locations: locationsWithIds }

    persist(saveBusinessToDb(newBusiness), 'addBusiness')
    setBusinesses(prev => [...prev, newBusiness])

    if (newBusiness.locations && newBusiness.locations.length > 0) {
      const seeded = newBusiness.locations.map(loc =>
        buildDefaultRateCard(businessId, loc.id, {
          billingEmail: loc.billingEmail || '',
          backupEmail: loc.backupEmail || '',
        }),
      )
      for (const rc of seeded) persist(saveRateCardToDb(rc), 'seedRateCard')
      setRateCards(prev => {
        const existingIds = new Set(prev.map(rc => rc.locationId))
        const additions = seeded.filter(rc => !existingIds.has(rc.locationId))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
    }

    return newBusiness
  }, [buildDefaultRateCard])

  // Adds a location to an existing business and auto-creates a rate card so
  // the new location is immediately usable for billing.
  const addLocation = useCallback(
    (businessId: string, location: Omit<BusinessLocation, 'id' | 'businessId'>): BusinessLocation | null => {
      const business = businesses.find(b => b.id === businessId)
      if (!business) return null

      const newLocation: BusinessLocation = {
        ...location,
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `location-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
      }

      persist(saveLocationToDb(businessId, newLocation), 'addLocation')
      setBusinesses(prev =>
        prev.map(b =>
          b.id === businessId ? { ...b, locations: [...b.locations, newLocation] } : b,
        ),
      )

      const seeded = buildDefaultRateCard(businessId, newLocation.id, {
        billingEmail: newLocation.billingEmail || '',
        backupEmail: newLocation.backupEmail || '',
      })
      persist(saveRateCardToDb(seeded), 'seedRateCardForNewLocation')
      setRateCards(prev => (prev.some(rc => rc.locationId === newLocation.id) ? prev : [...prev, seeded]))

      return newLocation
    },
    [businesses, buildDefaultRateCard],
  )

  // Settings functions
  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    persist(saveSettingsToDb(newSettings), 'updateSettings')
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
        persist(saveRateCardToDb(updated[existingIndex]), 'saveRateCard:update')
        return updated
      } else {
        // Create new — centralized defaults via buildDefaultRateCard.
        const location = businesses.flatMap(b => b.locations).find(l => l.id === locationId)
        const newRateCard = buildDefaultRateCard(
          location?.businessId || '',
          locationId,
          rateCardData,
        )
        persist(saveRateCardToDb(newRateCard), 'saveRateCard:create')
        return [...prev, newRateCard]
      }
    })
  }, [businesses, buildDefaultRateCard])

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
      sentAt: null,
      openedAt: null,
      remindersPaused: false,
      remindersSkipCount: 0,
      emailBounced: false,
      backupBillingEmail: rateCard.backupEmail || null,
      recipientPhone: null,
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
        // Strip out any future/scheduled reminder events - they're cancelled on payment
        const logWithoutScheduled = inv.emailLog.filter(e => !e.isScheduled)
        return {
          ...inv,
          status: 'paid' as const,
          paidDate: paymentDetails.date,
          paymentMethod: paymentDetails.method,
          paymentReference: paymentDetails.reference,
          amountReceived: paymentDetails.amountReceived,
          remindersPaused: false,
          updatedAt: new Date().toISOString(),
          emailLog: [
            ...logWithoutScheduled,
            {
              id: `e-${Date.now()}`,
              type: 'paid' as const,
              timestamp: new Date().toISOString(),
              note: `Marked as paid via ${paymentDetails.method.replace('_', ' ')}${paymentDetails.reference ? ` (ref: ${paymentDetails.reference})` : ''}`,
            },
          ],
        }
      }
      return inv
    }))
  }, [])

  // ===== Invoice sending & reminder controls =====

  const toggleAutoSend = useCallback(() => {
    setSettings(prev => {
      const nextValue = !prev.autoSendInvoices
      persist(saveSettingsToDb({ autoSendInvoices: nextValue }), 'toggleAutoSend')
      return { ...prev, autoSendInvoices: nextValue }
    })
  }, [])

  const updateInvoiceSettings = useCallback((next: Partial<SystemSettings>) => {
    persist(saveSettingsToDb(next), 'updateInvoiceSettings')
    setSettings(prev => ({ ...prev, ...next }))
  }, [])

  const computeScheduledEvents = useCallback((sentAt: Date, due: Date, s: SystemSettings): InvoiceEmailEvent[] => {
    const addDays = (d: Date, n: number) => {
      const c = new Date(d)
      c.setDate(c.getDate() + n)
      return c
    }
    return [
      { id: `e-${Date.now()}-r1`, type: 'reminder_1', timestamp: addDays(sentAt, s.reminderDay1).toISOString(), isScheduled: true },
      { id: `e-${Date.now()}-r2`, type: 'reminder_2', timestamp: due.toISOString(), isScheduled: true },
      { id: `e-${Date.now()}-od`, type: 'overdue_notice', timestamp: addDays(due, s.overdueDay).toISOString(), isScheduled: true },
      { id: `e-${Date.now()}-esc`, type: 'escalated', timestamp: addDays(due, s.escalationDay).toISOString(), isScheduled: true, note: 'Escalation scheduled if unpaid' },
    ]
  }, [])

  const sendSingleInvoice = useCallback((invoiceId: string, opts?: { backupEmail?: string }) => {
    const invoice = invoices.find(i => i.id === invoiceId)
    if (!invoice) return { ok: false, reason: 'Invoice not found' }
    if (invoice.status !== 'draft') return { ok: false, reason: 'Invoice is not a draft' }
    const primary = invoice.billingEmail?.trim()
    if (!primary) return { ok: false, reason: 'No billing email set' }
    if (invoice.emailBounced && !opts?.backupEmail) return { ok: false, reason: 'Primary email previously bounced — provide a new one' }

    const sendTo = opts?.backupEmail || primary
    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + settings.invoiceDueDays)

    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      const sentEvent: InvoiceEmailEvent = {
        id: `e-${Date.now()}-sent`,
        type: 'sent',
        timestamp: now.toISOString(),
        email: sendTo,
      }
      const scheduled = computeScheduledEvents(now, due, settings)
      return {
        ...inv,
        status: 'sent' as const,
        sentAt: now.toISOString(),
        dueDate: due.toISOString().split('T')[0],
        billingEmail: sendTo,
        emailBounced: false,
        updatedAt: now.toISOString(),
        emailLog: [...inv.emailLog, sentEvent, ...scheduled],
      }
    }))
    return { ok: true }
  }, [invoices, settings, computeScheduledEvents])

  const sendAllDraftInvoices = useCallback(() => {
    const drafts = invoices.filter(i => i.status === 'draft')
    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + settings.invoiceDueDays)

    const sent: Invoice[] = []
    const skipped: Invoice[] = []

    setInvoices(prev => prev.map(inv => {
      if (inv.status !== 'draft') return inv
      const email = inv.billingEmail?.trim()
      if (!email || inv.emailBounced) {
        skipped.push(inv)
        return inv
      }
      const sentEvent: InvoiceEmailEvent = {
        id: `e-${Date.now()}-${inv.id}-sent`,
        type: 'sent',
        timestamp: now.toISOString(),
        email,
      }
      const scheduled = computeScheduledEvents(now, due, settings)
      const next: Invoice = {
        ...inv,
        status: 'sent',
        sentAt: now.toISOString(),
        dueDate: due.toISOString().split('T')[0],
        updatedAt: now.toISOString(),
        emailLog: [...inv.emailLog, sentEvent, ...scheduled],
      }
      sent.push(next)
      return next
    }))

    return { sent, skipped }
  }, [invoices, settings, computeScheduledEvents])

  const pauseReminders = useCallback((invoiceId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      return {
        ...inv,
        remindersPaused: true,
        updatedAt: new Date().toISOString(),
        emailLog: [
          ...inv.emailLog,
          { id: `e-${Date.now()}`, type: 'reminders_paused', timestamp: new Date().toISOString() },
        ],
      }
    }))
  }, [])

  const resumeReminders = useCallback((invoiceId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      return {
        ...inv,
        remindersPaused: false,
        updatedAt: new Date().toISOString(),
        emailLog: [
          ...inv.emailLog,
          { id: `e-${Date.now()}`, type: 'reminders_resumed', timestamp: new Date().toISOString() },
        ],
      }
    }))
  }, [])

  const skipNextReminder = useCallback((invoiceId: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      // Remove the next scheduled reminder (first isScheduled reminder event in order)
      const idx = inv.emailLog.findIndex(e => e.isScheduled && (e.type === 'reminder_1' || e.type === 'reminder_2' || e.type === 'overdue_notice'))
      const nextLog = [...inv.emailLog]
      if (idx >= 0) nextLog.splice(idx, 1)
      nextLog.push({ id: `e-${Date.now()}`, type: 'skipped', timestamp: new Date().toISOString(), note: 'Admin skipped next reminder' })
      return {
        ...inv,
        remindersSkipCount: inv.remindersSkipCount + 1,
        updatedAt: new Date().toISOString(),
        emailLog: nextLog,
      }
    }))
  }, [])

  const updateInvoiceBillingEmail = useCallback((invoiceId: string, email: string) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, billingEmail: email, emailBounced: false, updatedAt: new Date().toISOString() } : inv))
  }, [])

  const updateInvoiceBackupEmail = useCallback((invoiceId: string, email: string) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, backupBillingEmail: email || null, updatedAt: new Date().toISOString() } : inv))
  }, [])

  const resendBouncedInvoice = useCallback((invoiceId: string, newEmail: string) => {
    const now = new Date()
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      return {
        ...inv,
        billingEmail: newEmail,
        emailBounced: false,
        sentAt: inv.sentAt || now.toISOString(),
        status: inv.status === 'draft' ? 'sent' : inv.status,
        updatedAt: now.toISOString(),
        emailLog: [
          ...inv.emailLog,
          { id: `e-${Date.now()}`, type: 'resent', timestamp: now.toISOString(), email: newEmail, note: `Resent after bounce to ${newEmail}` },
        ],
      }
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

    // Persist the dispute + flip invoice status to 'disputed'.
    persist(
      insertDispute({ invoiceId, lineItemId, claim, photoUrl }).then(({ id, createdAt }) => {
        setDisputes(prev =>
          prev.map(d => (d.id === newDispute.id ? { ...d, id, createdAt } : d)),
        )
      }),
      'insertDispute',
    )
    persist(updateInvoiceStatusOnly(invoiceId, 'disputed'), 'invoice->disputed')

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

    persist(
      resolveDisputeInDb(disputeId, action, adminNote, creditAmount ?? null),
      'resolveDispute',
    )

    // If accepted, update invoice status back to sent (reminders can resume)
    const dispute = disputes.find(d => d.id === disputeId)
    if (dispute) {
      persist(updateInvoiceStatusOnly(dispute.invoiceId, 'sent'), 'invoice->sent')
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

    // Persist and swap in the DB-assigned UUID.
    persist(
      insertSMSLog({
        deliveryId: newSMS.deliveryId,
        invoiceId: newSMS.invoiceId,
        recipientName: newSMS.recipientName,
        recipientPhone: newSMS.recipientPhone,
        type: newSMS.type,
        message: newSMS.message,
        status: newSMS.status,
        sentAt: newSMS.sentAt,
        deliveredAt: newSMS.deliveredAt,
        errorMessage: newSMS.errorMessage,
      }).then(saved => {
        if (saved.id !== newSMS.id) {
          setSMSLog(prev => prev.map(s => (s.id === newSMS.id ? saved : s)))
        }
      }),
      'insertSMSLog',
    )

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
    persist(markAdminNotificationReadInDb(notificationId, false), 'markAdminNotificationRead')
    setAdminNotifications(prev => prev.map(n => {
      if (n.id === notificationId) {
        return { ...n, read: true }
      }
      return n
    }))
  }, [])

  const markAllAdminNotificationsRead = useCallback(() => {
    persist(markAdminNotificationReadInDb('', true), 'markAllAdminNotificationsRead')
    setAdminNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const retrySMS = useCallback((smsLogId: string) => {
    persist(markSMSRetriedInDb(smsLogId), 'retrySMS')
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

    // Add admin notification (optimistic + persisted)
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
    persist(
      insertAdminNotification({
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.message,
        deliveryId: newNotification.deliveryId,
        driverId: newNotification.driverId,
        businessId: newNotification.businessId,
        invoiceId: newNotification.invoiceId,
        priority: newNotification.priority,
        read: false,
      }).then(saved => {
        if (saved.id !== newNotification.id) {
          setAdminNotifications(prev => prev.map(n => (n.id === newNotification.id ? saved : n)))
        }
      }),
      'insertAdminNotification:escalate',
    )
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
    persist(updateDriverRow(driverId, { max_jobs_override: maxJobs }), 'updateDriverCapacity')
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
        isHydrating,
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
    addLocation,
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
        toggleAutoSend,
        updateInvoiceSettings,
        sendSingleInvoice,
        sendAllDraftInvoices,
        pauseReminders,
        resumeReminders,
        skipNextReminder,
        updateInvoiceBillingEmail,
        updateInvoiceBackupEmail,
        resendBouncedInvoice,
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
