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
  InvoiceLine,
  LocationBreakdown,
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
  BusinessUserRole,
  BusinessUser,
  LocationReport,
  BusinessReport,
} from './types'
import { calculateInvoiceLines, calculateGST, generateInvoiceNumber, DEFAULT_RATE_CARD_VALUES, calculateBreakdown } from './billing'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { unregisterDevicePush } from '@/lib/native/push'
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
  createInvoiceInDb,
  updateLocationBillingEmails,
  updateLocationCoordinates,
  updateTripOrder,
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
  // Driver pay tracking – disabled by default
  driverPayEnabled: false,
  // SMS feature toggles – defaults match the DB column defaults
  smsNotifyEnRoutePickup: true,
  smsNotifyPickedUp: true,
  smsNotifyFailedAttempt: true,
  smsNotifyCancelled: true,
  smsNotifyReassigned: true,
  smsNotifyFeedbackRequest: true,
  smsNotifyInvoiceReady: true,
  smsNotifyPaymentReceived: true,
  smsNotifyWeeklySummary: false,
  smsOptOutManagement: true,
  smsShiftReminder: false,
  smsEarningsSummary: false,
  // Dispatch mode – defaults to self-claim (current behavior)
  allowDriverSelfClaim: true,
  // Minimum proof-of-delivery photos required at drop-off
  minDeliveryPhotos: 3,
  // Invoice template settings
  invoiceCompanyName: '',
  invoiceCompanyAddress: '',
  invoiceCompanyPhone: '',
  invoiceCompanyEmail: '',
  invoiceTaxNumber: '',
  invoiceTaxLabel: 'GST',
  invoiceTaxRate: 0,
  invoicePaymentTerms: 'Net 15',
  invoicePaymentInstructions: '',
  invoiceBankName: '',
  invoiceBankAccountName: '',
  invoiceBankAccountNumber: '',
  invoiceBankTransitNumber: '',
  invoiceBankInstitutionNumber: '',
  invoiceFooterNotes: '',
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
  completeDelivery: (
    deliveryId: string,
    photoUrls: string[],
    recipientNote: string | null,
    signatureUrl?: string | null,
  ) => void
  failDelivery: (deliveryId: string, reason: FailReason, notes?: string) => void
  flagDelivery: (deliveryId: string, type: DeliveryFlag['type'], note: string, photoUrl: string | null) => void
  resolveFlag: (deliveryId: string, flagId: string, action: 'proceed' | 'cancel' | 'modify') => void
  postDelivery: (data: Partial<Delivery>) => Promise<Delivery | null>
  reassignDriver: (deliveryId: string, newDriverId: string) => void
  cancelOrderByBusiness: (deliveryId: string, reason?: string) => { ok: boolean; error?: string }
  // Admin dispatch assignment (bypasses driver limits, records who assigned)
  assignDelivery: (deliveryId: string, driverId: string, adminUserId: string) => void

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
  
  // Multi-store access control
  getAccessibleLocations: () => BusinessLocation[]
  canAccessLocation: (locationId: string) => boolean
  isOwner: () => boolean
  getBusinessUsers: (businessId: string) => BusinessUser[]
  inviteBusinessUser: (email: string, role: BusinessUserRole, locationIds: string[]) => Promise<{ success: boolean; error?: string }>
  removeBusinessUser: (userId: string) => Promise<{ success: boolean; error?: string }>
  updateUserLocationAccess: (userId: string, locationIds: string[]) => Promise<{ success: boolean; error?: string }>
  setActiveLocation: (locationId: string | 'all') => void
  activeLocationId: string | 'all'  // Current selected location filter
  
  // Reports
  getLocationReport: (locationId: string, start: string, end: string) => LocationReport
  getBusinessReport: (businessId: string, start: string, end: string) => BusinessReport
  
  // Settings functions
  updateSettings: (settings: Partial<SystemSettings>) => void
  
  // Notification functions
  markNotificationRead: (notificationId: string) => void
  
  // Billing functions
  saveRateCard: (locationId: string, rateCard: Partial<RateCard>) => void
  updateLocationEmails: (locationId: string, billingEmail: string, backupEmail: string | null) => void
  updateLocationCoords: (locationId: string, lat: number, lng: number) => void
  getRateCardForLocation: (locationId: string) => RateCard | null
  refreshRateCards: () => Promise<void>
  generateInvoice: (businessId: string, locationId: string, periodStart: string, periodEnd: string) => Invoice | null
  generateBusinessInvoices: (
    businessId: string,
    periodStart: string,
    periodEnd: string,
    formatOverride?: 'combined' | 'separate' | 'combined_breakdown'
  ) => Invoice[]
  markInvoicePaid: (invoiceId: string, paymentDetails: PaymentDetails) => void
  disputeLineItem: (invoiceId: string, lineItemId: string, claim: string, photoUrl: string | null) => void
  resolveDispute: (disputeId: string, action: 'accept' | 'reject', adminNote: string, creditAmount?: number) => void
  matchPayment: (paymentId: string, invoiceId: string) => void
  // Invoice sending / reminders
  toggleAutoSend: () => void
  updateInvoiceSettings: (settings: Partial<SystemSettings>) => void
  sendSingleInvoice: (invoiceId: string, opts?: { backupEmail?: string }) => Promise<{ ok: boolean; reason?: string }>
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
  
  // Data
  refreshData: () => Promise<void>

  // Helpers
  getDriverActiveJobs: (driverId: string) => number
  getDriverMaxJobs: (driverId: string) => number
  canDriverClaimJob: (driverId: string) => boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null)
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)
  const [activeLocationId, setActiveLocationId] = useState<string | 'all' | null>(null)
  const [isHydrating, setIsHydrating] = useState<boolean>(true)
  const [businessUsers, setBusinessUsers] = useState<BusinessUser[]>([])
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

  // -------------------------------------------------------------------------
  // Lightweight refresh of the shared, DB-backed entities (deliveries,
  // drivers, businesses, invoices). Unlike hydrateFromDb this does NOT reset
  // in-memory-only state (notifications, SMS log, etc.), so it's safe to run
  // on an interval. This is what makes a business-created delivery show up in
  // an already-open driver session, and keeps every role's data fresh.
  // -------------------------------------------------------------------------
  const refreshData = useCallback(async () => {
    if (!currentUser) return
    const profile = {
      role: currentUser.role,
      businessId: currentUser.businessId || null,
      driverId: currentUser.driverId || null,
    }
    try {
      const [b, d, dl, inv, s] = await Promise.all([
        loadAllBusinesses().catch(() => null),
        loadAllDrivers().catch(() => null),
        loadDeliveries(profile).catch(() => null),
        loadInvoices(profile).catch(() => null),
        loadSettings().catch(() => null),
      ])
      if (b) setBusinesses(b)
      if (d) setDrivers(d)
      if (s) setSettings(s)
      if (dl) {
        const byBizId = new Map((b || businesses).map((biz) => [biz.id, biz.name]))
        setDeliveries(
          dl.map((x) => (x.businessName ? x : { ...x, businessName: byBizId.get(x.businessId) || '' })),
        )
      }
      if (inv) setInvoices(inv)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[db] refresh failed', err)
    }
  }, [currentUser, businesses])

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
      id: authUser.id,
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

  // Keep the shared data fresh across sessions/devices. Polls every 15s while
  // logged in, and refreshes immediately when the tab regains focus so a
  // driver who switches back to the app sees newly posted jobs right away.
  useEffect(() => {
    if (!currentUser || isHydrating) return
    const interval = setInterval(() => { void refreshData() }, 15000)
    const onFocus = () => { void refreshData() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshData() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [currentUser, isHydrating, refreshData])

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
    // Drop this device's push token while still authenticated (no-op on web).
    await unregisterDevicePush()
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
    // Block self-claim if admin assignment mode is active
    if (!settings.allowDriverSelfClaim) {
      console.warn('[v0] Self-claim blocked: dispatch assignment mode is active')
      return
    }
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

    // Fire-and-forget: notify driver with job details + notify business that driver assigned
    void fetch('/api/sms/driver-assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, driverId }),
    }).catch(err => console.error('[v0] driver-assigned SMS failed', err))
  }, [drivers, settings.allowDriverSelfClaim])

  const verifyPickup = useCallback((deliveryId: string, verifications: PickupVerification[]) => {
    // Persist the verified qty + rate to the DB. Rate calculation happens
    // server-side via the existing billing trigger when we update the row.
    const delivery = deliveries.find(d => d.id === deliveryId)
    const rateCardForLoc = delivery ? rateCards.find(rc => rc.locationId === delivery.locationId) : null
    
    // Build confirmed manifest with verified quantities
    const confirmedManifest = delivery?.manifest.map(item => {
      const v = verifications.find(ver => ver.itemId === item.id)
      return { ...item, confirmedQty: v?.confirmedQty ?? item.postedQty }
    }) || []
    
    // Check if any item was marked out of town
    const hasOutOfTown = verifications.some(v => v.outOfTown)
    const effectiveOot = hasOutOfTown || delivery?.isOutOfTown || false
    
    // Calculate the rate using confirmed quantities
    const breakdown = calculateBreakdown(
      confirmedManifest,
      effectiveOot,
      delivery?.isUrgent || false,
      rateCardForLoc || null,
      true, // useConfirmed
      delivery?.distanceKm ?? null
    )
    
    const calculatedRate = breakdown.rate
    const gstAmount = rateCardForLoc?.gstApplicable ? Math.round(calculatedRate * 0.05 * 100) / 100 : 0
    const totalAmount = calculatedRate + gstAmount
    
    persist(
      applyPickupVerifications(
        deliveryId,
        verifications,
        calculatedRate,
        gstAmount,
        totalAmount,
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
          calculatedRate,
          gstAmount,
          totalAmount,
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
  }, [deliveries, rateCards])

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
      if (next) {
        // Build the update payload — add timestamp for en_route_dropoff
        const updateFields: Record<string, unknown> = { status: next }
        if (next === 'en_route_dropoff') {
          updateFields.en_route_dropoff_at = new Date().toISOString()
        }
        persist(updateDeliveryFields(deliveryId, updateFields), 'advanceStatus')
        // Note: the "en route to pickup" business SMS was intentionally removed
        // to cut message volume — the business is notified again moments later
        // when the package is actually picked up (below).
        // When package is picked up — notify business
        if (next === 'picked_up') {
          void fetch('/api/sms/picked-up', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryId }),
          }).catch(err => console.error('[v0] picked-up SMS failed', err))
        }
        // When the package starts heading to the recipient, SMS them.
        if (next === 'en_route_dropoff') {
          void fetch('/api/sms/pickup-ready', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryId }),
          }).catch(err => console.error('[v0] pickup-ready SMS failed', err))
        }
      }
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

  const completeDelivery = useCallback((
    deliveryId: string,
    photoUrls: string[],
    recipientNote: string | null,
    signatureUrl?: string | null,
  ) => {
    const delivery = deliveries.find(d => d.id === deliveryId)
    const now = new Date()
    const pickedUpAt = delivery?.pickedUpAt ? new Date(delivery.pickedUpAt) : null
    const durationMins = pickedUpAt ? Math.round((now.getTime() - pickedUpAt.getTime()) / 60000) : null
    // First photo remains the primary proof; the full set is stored as an array.
    const primaryPhoto = photoUrls[0] ?? null
    persist(
      updateDeliveryFields(deliveryId, {
        status: 'delivered',
        delivered_at: now.toISOString(),
        duration_mins: durationMins,
        proof_photo_url: primaryPhoto,
        proof_photo_urls: photoUrls,
        signature_url: signatureUrl ?? null,
        recipient_note: recipientNote,
      }),
      'completeDelivery',
    )
    // Fire-and-forget: notify both the recipient and the business that the
    // package was delivered. Both link to /track/<id> which renders the proof
    // photo + signature so each side has a verifiable record.
    void fetch('/api/sms/delivered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId }),
    }).catch(err => console.error('[v0] delivered SMS failed', err))
    
    // Send feedback request SMS (setting-gated in the API endpoint)
    void fetch('/api/sms/feedback-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId }),
    }).catch(err => console.error('[v0] feedback request SMS failed', err))
    
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
          proofPhotoUrl: photoUrls[0] ?? null,
          proofPhotoUrls: photoUrls,
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
    // Fire-and-forget: notify recipient and business of failed attempt
    void fetch('/api/sms/failed-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, retryCount: retriesSoFar + 1 }),
    }).catch(err => console.error('[v0] failed-attempt SMS failed', err))
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

  const postDelivery = useCallback(async (data: Partial<Delivery>): Promise<Delivery | null> => {
    // Write to DB first so the app has a real UUID + the row survives refresh.
    // We await the create so callers (e.g. the order form) can immediately print
    // a label for the saved row, but the SMS/geocode side effects stay async.
    const businessId = data.businessId || ''
    const locationId = data.locationId || ''
    if (!businessId || !locationId) {
      // eslint-disable-next-line no-console
      console.error('[db] postDelivery missing businessId/locationId')
      return null
    }
    try {
      const saved = await createDeliveryInDb({
        businessId,
        locationId,
        pickupAddress: data.pickupAddress || '',
        pickupArea: data.pickupArea || '',
        pickupPostalCode: data.pickupPostalCode ?? null,
        pickupLat: data.pickupLat ?? null,
        pickupLng: data.pickupLng ?? null,
        dropoffAddress: data.dropoffAddress || '',
        dropoffArea: data.dropoffArea || '',
        dropoffPostalCode: data.dropoffPostalCode ?? null,
        dropoffLat: data.dropoffLat ?? null,
        dropoffLng: data.dropoffLng ?? null,
        recipientName: data.recipientName ?? null,
        recipientPhone: data.recipientPhone ?? null,
        recipientNote: data.recipientNote ?? null,
        buzzCode: data.buzzCode ?? null,
        isRush: data.isRush ?? false,
        isUrgent: data.isUrgent ?? false,
        isOutOfTown: data.isOutOfTown ?? false,
        requireSignature: data.requireSignature ?? false,
        requirePhoto: data.requirePhoto ?? true,
        distanceKm: data.distanceKm ?? null,
        manifest: (data.manifest || []).map(m => ({
          type: m.type,
          quantity: m.postedQty,
          notes: m.notes || undefined,
        })),
      })

      // Attach businessName from our local state for display convenience.
      const bName = businesses.find(b => b.id === saved.businessId)?.name || ''
      const enriched = { ...saved, businessName: bName }
      setDeliveries(prev => {
        // Dedupe: if somehow this ID was already added locally, replace it.
        const withoutDupe = prev.filter(d => d.id !== saved.id)
        return [enriched, ...withoutDupe]
      })

      // Fire-and-forget: broadcast SMS alert to all on-duty drivers.
      void fetch('/api/sms/job-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: saved.id }),
      }).catch(err => console.error('[v0] job-alert SMS failed', err))

      // Fire-and-forget: confirm order to business + send tracking to recipient
      void fetch('/api/sms/order-confirmed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: saved.id }),
      }).catch(err => console.error('[v0] order-confirmed SMS failed', err))

      // Fire-and-forget: geocode pickup/dropoff addresses so the track page can
      // show map pins. This runs async and updates the row via realtime.
      void fetch('/api/delivery/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: saved.id }),
      }).catch(err => console.error('[v0] geocode failed', err))

      return enriched
    } catch (err) {
      console.error('[db] postDelivery failed', err)
      return null
    }
  }, [businesses])

  const reassignDriver = useCallback((deliveryId: string, newDriverId: string) => {
    const newDriver = drivers.find(d => d.id === newDriverId)
    if (!newDriver) return
    const currentDelivery = deliveries.find(d => d.id === deliveryId)
    const oldDriverId = currentDelivery?.driverId ?? null

    // Persist the reassignment to the DB so it survives a refresh.
    persist(
      updateDeliveryFields(deliveryId, { driver_id: newDriverId }),
      'reassignDriver',
    )

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
    // Fire-and-forget: notify new driver, old driver (if any), and business
    void fetch('/api/sms/reassigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, newDriverId, oldDriverId }),
    }).catch(err => console.error('[v0] reassigned SMS failed', err))
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
      // Fire-and-forget: notify all parties of cancellation
      void fetch('/api/sms/cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId }),
      }).catch(err => console.error('[v0] cancelled SMS failed', err))
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

  // Admin dispatch: assign a delivery to a driver (bypasses slot limits)
  const assignDelivery = useCallback(
    (deliveryId: string, driverId: string, adminUserId: string) => {
      const driver = drivers.find(d => d.id === driverId)
      if (!driver) return

      const now = new Date().toISOString()
      // assigned_by is a uuid column. Only write it when we actually have a
      // valid UUID (the admin's auth id); otherwise omit it so the whole
      // update doesn't fail on an invalid-uuid cast (which previously caused
      // the assignment to silently not persist and reappear as unassigned).
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        adminUserId,
      )
      persist(
        updateDeliveryFields(deliveryId, {
          driver_id: driverId,
          status: 'claimed',
          claimed_at: now,
          assigned_at: now,
          ...(isUuid ? { assigned_by: adminUserId } : {}),
        }),
        'assignDelivery',
      )

      setDeliveries(prev =>
        prev.map(d =>
          d.id === deliveryId
            ? {
                ...d,
                driverId,
                driverName: driver.name,
                status: 'claimed' as DeliveryStatus,
                claimedAt: now,
                assignedAt: now,
                assignedBy: adminUserId,
                statusHistory: [
                  ...d.statusHistory,
                  {
                    status: 'claimed' as DeliveryStatus,
                    timestamp: now,
                    note: `Assigned by dispatch to ${driver.name}`,
                    gpsLat: null,
                    gpsLng: null,
                  },
                ],
              }
            : d,
        ),
      )

      // Fire-and-forget: notify driver of the assignment
      void fetch('/api/sms/driver-assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, driverId }),
      }).catch(err => console.error('[v0] driver-assigned SMS failed', err))
    },
    [drivers],
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
        buildDefaultRateCard(businessId, loc.id),
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

      // Seed a default rate card for the new location
      const seeded = buildDefaultRateCard(businessId, newLocation.id)
      persist(saveRateCardToDb(seeded), 'seedRateCardForNewLocation')
      setRateCards(prev => (prev.some(rc => rc.locationId === newLocation.id) ? prev : [...prev, seeded]))

      return newLocation
    },
    [businesses, buildDefaultRateCard],
  )

  // ---- Multi-store access control functions ----
  
  // Check if current user is an owner
  const isOwner = useCallback(() => {
    if (!currentUser || currentUser.role !== 'business') return false
    return currentUser.businessRole === 'owner' || !currentUser.businessRole // Legacy users default to owner
  }, [currentUser])
  
  // Get all locations the current user can access
  const getAccessibleLocations = useCallback((): BusinessLocation[] => {
    if (!currentUser || currentUser.role !== 'business') return []
    
    const business = businesses.find(b => b.id === currentUser.businessId)
    if (!business) return []
    
    // Owners and legacy users (no businessRole) can access all locations
    if (isOwner()) {
      return business.locations
    }
    
    // Managers and viewers can only access assigned locations
    if (currentUser.managedLocationIds && currentUser.managedLocationIds.length > 0) {
      return business.locations.filter(loc => 
        currentUser.managedLocationIds?.includes(loc.id)
      )
    }
    
    // Fallback: if single location assigned, use that
    if (currentUser.locationId) {
      return business.locations.filter(loc => loc.id === currentUser.locationId)
    }
    
    return []
  }, [currentUser, businesses, isOwner])
  
  // Check if current user can access a specific location
  const canAccessLocation = useCallback((locationId: string): boolean => {
    if (!currentUser) return false
    
    // Admins can access everything
    if (currentUser.role === 'admin') return true
    
    // Non-business users can't access locations
    if (currentUser.role !== 'business') return false
    
    const accessibleLocations = getAccessibleLocations()
    return accessibleLocations.some(loc => loc.id === locationId)
  }, [currentUser, getAccessibleLocations])
  
  // Get all business users for a business
  const getBusinessUsers = useCallback((businessId: string): BusinessUser[] => {
    return businessUsers.filter(u => u.businessId === businessId)
  }, [businessUsers])
  
  // Set the active location filter (for multi-store views)
  const setActiveLocation = useCallback((locationId: string | 'all') => {
    // Validate access
    if (locationId !== 'all' && !canAccessLocation(locationId)) {
      console.warn('[v0] User does not have access to location:', locationId)
      return
    }
    // Only owners can view 'all'
    if (locationId === 'all' && !isOwner()) {
      console.warn('[v0] Only owners can view all locations')
      return
    }
    setActiveLocationId(locationId)
  }, [canAccessLocation, isOwner])
  
  // Invite a new user to the business
  const inviteBusinessUser = useCallback(async (
    email: string,
    role: BusinessUserRole,
    locationIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !currentUser.businessId) {
      return { success: false, error: 'Not logged in as business user' }
    }
    if (!isOwner()) {
      return { success: false, error: 'Only owners can invite users' }
    }
    
    // TODO: Implement actual invitation logic with Supabase
    // For now, just log the attempt
    console.log('[v0] Would invite user:', { email, role, locationIds })
    
    // Create a mock invitation record
    const newUser: BusinessUser = {
      id: `bu-${Date.now()}`,
      userId: `pending-${Date.now()}`,
      businessId: currentUser.businessId,
      email,
      name: email.split('@')[0],
      businessRole: role,
      managedLocationIds: role === 'owner' ? [] : locationIds,
      createdAt: new Date().toISOString(),
    }
    
    setBusinessUsers(prev => [...prev, newUser])
    return { success: true }
  }, [currentUser, isOwner])
  
  // Remove a user from the business
  const removeBusinessUser = useCallback(async (
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isOwner()) {
      return { success: false, error: 'Only owners can remove users' }
    }
    
    // TODO: Implement actual removal logic with Supabase
    setBusinessUsers(prev => prev.filter(u => u.userId !== userId))
    return { success: true }
  }, [isOwner])
  
  // Update a user's location access
  const updateUserLocationAccess = useCallback(async (
    userId: string,
    locationIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isOwner()) {
      return { success: false, error: 'Only owners can modify user access' }
    }
    
    // TODO: Implement actual update logic with Supabase
    setBusinessUsers(prev => prev.map(u => 
      u.userId === userId 
        ? { ...u, managedLocationIds: locationIds }
        : u
    ))
    return { success: true }
  }, [isOwner])

  // ---- Reporting functions ----
  
  // Generate a report for a single location
  const getLocationReport = useCallback((
    locationId: string,
    start: string,
    end: string
  ): LocationReport => {
    const business = businesses.find(b => b.locations.some(l => l.id === locationId))
    const location = business?.locations.find(l => l.id === locationId)
    
    // Filter deliveries for this location and period
    const periodDeliveries = deliveries.filter(d => 
      d.locationId === locationId &&
      d.createdAt &&
      d.createdAt >= start &&
      d.createdAt <= end
    )
    
    const completedDeliveries = periodDeliveries.filter(d => d.status === 'delivered')
    const failedDeliveries = periodDeliveries.filter(d => 
      d.status === 'failed_permanent' || d.status === 'failed_retry'
    )
    const cancelledDeliveries = periodDeliveries.filter(d => d.status === 'cancelled')
    
    // Calculate average delivery time (from created to delivered)
    const deliveryTimes = completedDeliveries
      .filter(d => d.deliveredAt && d.createdAt)
      .map(d => {
        const created = new Date(d.createdAt!).getTime()
        const delivered = new Date(d.deliveredAt!).getTime()
        return (delivered - created) / (1000 * 60) // minutes
      })
    const avgDeliveryMins = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : 0
    
    // Get invoices for this location
    const locationInvoices = invoices.filter(inv => 
      inv.locationId === locationId &&
      inv.periodStart >= start &&
      inv.periodEnd <= end
    )
    const pendingInvoices = locationInvoices.filter(inv => 
      inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue'
    ).reduce((sum, inv) => sum + inv.total, 0)
    const paidInvoices = locationInvoices.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0)
    
    // Aggregate feedback (from delivery flags)
    const feedbackFlags = periodDeliveries.flatMap(d => d.flags || [])
    
    // Count issue types from flags
    const issueTypes = new Map<string, number>()
    feedbackFlags.forEach(f => {
      issueTypes.set(f.type, (issueTypes.get(f.type) || 0) + 1)
    })
    
    return {
      locationId,
      locationName: location?.name || 'Unknown',
      period: { start, end },
      totalDeliveries: periodDeliveries.length,
      completedDeliveries: completedDeliveries.length,
      failedDeliveries: failedDeliveries.length,
      cancelledDeliveries: cancelledDeliveries.length,
      avgDeliveryMins,
      totalSpend: paidInvoices + pendingInvoices,
      pendingInvoices,
      paidInvoices,
      avgRating: null, // TODO: Implement when ratings are added
      feedbackCount: feedbackFlags.length,
      positiveCount: 0, // TODO: Implement when positive feedback is tracked
      negativeCount: feedbackFlags.length,
      issues: Array.from(issueTypes.entries()).map(([type, count]) => ({ type, count })),
    }
  }, [businesses, deliveries, invoices])
  
  // Generate a consolidated report for a business (all locations)
  const getBusinessReport = useCallback((
    businessId: string,
    start: string,
    end: string
  ): BusinessReport => {
    const business = businesses.find(b => b.id === businessId)
    if (!business) {
      return {
        businessId,
        businessName: 'Unknown',
        period: { start, end },
        locations: [],
        totals: {
          totalDeliveries: 0,
          completedDeliveries: 0,
          failedDeliveries: 0,
          cancelledDeliveries: 0,
          avgDeliveryMins: 0,
          totalSpend: 0,
          pendingInvoices: 0,
          paidInvoices: 0,
          avgRating: null,
          feedbackCount: 0,
          positiveCount: 0,
          negativeCount: 0,
        },
      }
    }
    
    // Get reports for each location
    const locationReports = business.locations.map(loc => 
      getLocationReport(loc.id, start, end)
    )
    
    // Aggregate totals
    const totals = locationReports.reduce((acc, r) => ({
      totalDeliveries: acc.totalDeliveries + r.totalDeliveries,
      completedDeliveries: acc.completedDeliveries + r.completedDeliveries,
      failedDeliveries: acc.failedDeliveries + r.failedDeliveries,
      cancelledDeliveries: acc.cancelledDeliveries + r.cancelledDeliveries,
      avgDeliveryMins: acc.avgDeliveryMins + r.avgDeliveryMins,
      totalSpend: acc.totalSpend + r.totalSpend,
      pendingInvoices: acc.pendingInvoices + r.pendingInvoices,
      paidInvoices: acc.paidInvoices + r.paidInvoices,
      avgRating: null as number | null,
      feedbackCount: acc.feedbackCount + r.feedbackCount,
      positiveCount: acc.positiveCount + r.positiveCount,
      negativeCount: acc.negativeCount + r.negativeCount,
    }), {
      totalDeliveries: 0,
      completedDeliveries: 0,
      failedDeliveries: 0,
      cancelledDeliveries: 0,
      avgDeliveryMins: 0,
      totalSpend: 0,
      pendingInvoices: 0,
      paidInvoices: 0,
      avgRating: null as number | null,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
    })
    
    // Calculate average of averages for delivery time
    const avgMins = locationReports.filter(r => r.avgDeliveryMins > 0)
    totals.avgDeliveryMins = avgMins.length > 0
      ? Math.round(avgMins.reduce((sum, r) => sum + r.avgDeliveryMins, 0) / avgMins.length)
      : 0
    
    return {
      businessId,
      businessName: business.name,
      period: { start, end },
      locations: locationReports,
      totals,
    }
  }, [businesses, getLocationReport])

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

  // Refresh rate cards from the database (useful after adding locations)
  const refreshRateCards = useCallback(async () => {
    try {
      const rc = await loadAllRateCards()
      setRateCards(rc)
    } catch (err) {
      console.error('[db] failed to refresh rate cards', err)
    }
  }, [])

  // Update billing emails on a location (separate from rate card)
  const updateLocationEmails = useCallback((
    locationId: string,
    billingEmail: string,
    backupEmail: string | null
  ) => {
    setBusinesses(prev => prev.map(business => ({
      ...business,
      locations: business.locations.map(loc => 
        loc.id === locationId
          ? { ...loc, billingEmail, backupEmail: backupEmail || '' }
          : loc
      ),
    })))
    // Persist to database
    persist(updateLocationBillingEmails(locationId, billingEmail, backupEmail), 'updateLocationEmails')
  }, [])

  // Update location coordinates after geocoding
  const updateLocationCoords = useCallback((
    locationId: string,
    lat: number,
    lng: number
  ) => {
    setBusinesses(prev => prev.map(business => ({
      ...business,
      locations: business.locations.map(loc => 
        loc.id === locationId
          ? { ...loc, lat, lng }
          : loc
      ),
    })))
    // Persist to database
    persist(updateLocationCoordinates(locationId, lat, lng), 'updateLocationCoords')
  }, [])

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
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber(invoices),
      businessId,
      businessName: business.name,
      locationId,
      locationName: location.name,
      locationAddress: location.address,
      billingEmail: location.billingEmail,
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
      backupBillingEmail: location.backupEmail || null,
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
    
    // Persist the invoice to the database
    persist(createInvoiceInDb(newInvoice), 'createInvoice')
    
    return newInvoice
  }, [rateCards, businesses, deliveries, invoices, settings.invoiceDueDays])

  // Generate invoices for a business using the specified format
  // - separate: One invoice per location (default, existing behavior)
  // - combined: Single invoice with all location lines merged
  // - combined_breakdown: Single invoice with location-specific breakdowns
  const generateBusinessInvoices = useCallback((
    businessId: string,
    periodStart: string,
    periodEnd: string,
    formatOverride?: 'combined' | 'separate' | 'combined_breakdown'
  ): Invoice[] => {
    const business = businesses.find(b => b.id === businessId)
    if (!business) return []
    
    const format = formatOverride || business.invoiceFormat || 'separate'
    const generatedInvoices: Invoice[] = []
    
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (settings.invoiceDueDays || 15))
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const now = new Date().toISOString()
    
    if (format === 'separate') {
      // Generate one invoice per location (existing behavior)
      for (const location of business.locations) {
        const invoice = generateInvoice(businessId, location.id, periodStart, periodEnd)
        if (invoice) generatedInvoices.push(invoice)
      }
    } else {
      // Combined formats - gather all deliveries and lines first
      const locationData: Array<{
        location: BusinessLocation
        rateCard: RateCard
        lines: InvoiceLine[]
        subtotal: number
        gstAmount: number
        total: number
      }> = []
      
      let allLines: InvoiceLine[] = []
      let grandSubtotal = 0
      let grandGstAmount = 0
      
      for (const location of business.locations) {
        const rateCard = rateCards.find(rc => rc.locationId === location.id)
        if (!rateCard) continue
        
        const periodDeliveries = deliveries.filter(d => 
          d.locationId === location.id &&
          d.status === 'delivered' &&
          d.deliveredAt &&
          d.deliveredAt >= periodStart &&
          d.deliveredAt <= periodEnd
        )
        
        if (periodDeliveries.length === 0) continue
        
        const lines = calculateInvoiceLines(periodDeliveries, rateCard)
        const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
        const gstAmount = calculateGST(subtotal, rateCard.gstApplicable)
        
        locationData.push({
          location,
          rateCard,
          lines,
          subtotal,
          gstAmount,
          total: subtotal + gstAmount,
        })
        
        // For combined format, merge lines with location prefix
        const prefixedLines = lines.map((line, idx) => ({
          ...line,
          id: `${location.id}-${line.id}-${idx}`,
          description: format === 'combined' 
            ? `${location.name}: ${line.description}`
            : line.description,
        }))
        
        allLines = [...allLines, ...prefixedLines]
        grandSubtotal += subtotal
        grandGstAmount += gstAmount
      }
      
      if (locationData.length === 0) return []
      
      // Use first location's billing email for the combined invoice
      // (Admin can override this per-invoice)
      const primaryLocation = locationData[0].location
      
      const combinedInvoice: Invoice = {
        id: crypto.randomUUID(),
        invoiceNumber: generateInvoiceNumber(invoices),
        businessId,
        businessName: business.name,
        locationId: primaryLocation.id, // Primary location
        locationName: locationData.length > 1 
          ? `${business.name} (${locationData.length} locations)`
          : primaryLocation.name,
        locationAddress: primaryLocation.address,
        billingEmail: primaryLocation.billingEmail,
        periodStart,
        periodEnd,
        lines: allLines,
        subtotal: grandSubtotal,
        gstAmount: grandGstAmount,
        total: grandSubtotal + grandGstAmount,
        status: 'draft',
        dueDate: dueDateStr,
        paidDate: null,
        paymentMethod: null,
        paymentReference: null,
        amountReceived: null,
        sentAt: null,
        openedAt: null,
        remindersPaused: false,
        remindersSkipCount: 0,
        emailBounced: false,
        backupBillingEmail: primaryLocation.backupEmail || null,
        recipientPhone: null,
        // For combined_breakdown: include location breakdowns
        locationBreakdowns: format === 'combined_breakdown' 
          ? locationData.map(ld => ({
              locationId: ld.location.id,
              locationName: ld.location.name,
              lines: ld.lines,
              subtotal: ld.subtotal,
              gstAmount: ld.gstAmount,
              total: ld.total,
            }))
          : undefined,
        emailLog: [
          {
            id: `e-${Date.now()}`,
            type: 'generated',
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      }
      
      setInvoices(prev => [...prev, combinedInvoice])
      persist(createInvoiceInDb(combinedInvoice), 'createInvoice:combined')
      generatedInvoices.push(combinedInvoice)
    }
    
    return generatedInvoices
  }, [businesses, rateCards, deliveries, invoices, settings.invoiceDueDays, generateInvoice])

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
    // Fire-and-forget: SMS billing contact that payment was received
    void fetch('/api/sms/payment-received', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    }).catch(err => console.error('[v0] payment-received SMS failed', err))
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

  const sendSingleInvoice = useCallback(async (invoiceId: string, opts?: { backupEmail?: string }) => {
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

    // Call the API first - don't optimistically update
    try {
      const response = await fetch('/api/email/invoice-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, backupEmail: opts?.backupEmail }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.ok) {
        console.error('[v0] invoice-sent email failed:', result.error || result.reason)
        return { ok: false, reason: result.error || result.reason || 'Failed to send invoice email' }
      }
      
      // Email sent successfully - now update local state
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

      // Fire-and-forget: SMS the billing contact that their invoice is ready
      void fetch('/api/sms/invoice-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      }).catch(err => console.error('[v0] invoice-ready SMS failed', err))

      return { ok: true }
    } catch (err) {
      console.error('[v0] invoice-sent API error:', err)
      return { ok: false, reason: 'Failed to send invoice - network error' }
    }
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

    // Fire-and-forget email each invoice the server-side route will persist +
    // send via Resend + schedule reminder events.
    for (const inv of sent) {
      void fetch('/api/email/invoice-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id }),
      }).catch(err => console.error('[v0] bulk invoice-sent email failed', err))
    }

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
    // After the real dispute id is known, fire the admin notification email.
    persist(
      insertDispute({ invoiceId, lineItemId, claim, photoUrl }).then(({ id, createdAt }) => {
        setDisputes(prev =>
          prev.map(d => (d.id === newDispute.id ? { ...d, id, createdAt } : d)),
        )
        void fetch('/api/email/dispute-raised', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disputeId: id }),
        }).catch(err => console.error('[v0] dispute-raised email failed', err))
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
      resolveDisputeInDb(disputeId, action, adminNote, creditAmount ?? null).then(() => {
        void fetch('/api/email/dispute-resolved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disputeId }),
        }).catch(err => console.error('[v0] dispute-resolved email failed', err))
      }),
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
  // Only persist to database if it's a real trip (not a virtual one)
  if (tripId !== 'virtual-trip') {
    updateTripOrder(tripId, newOrder).catch(err => {
      console.error('[v0] Failed to persist trip order:', err)
    })
  }
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
      assignDelivery,
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
    // Multi-store access control
    getAccessibleLocations,
    canAccessLocation,
    isOwner,
    getBusinessUsers,
    inviteBusinessUser,
    removeBusinessUser,
    updateUserLocationAccess,
    setActiveLocation,
    activeLocationId: activeLocationId || 'all',
    getLocationReport,
    getBusinessReport,
    updateSettings,
        markNotificationRead,
        rateCards,
        invoices,
        disputes,
        unmatchedPayments,
    saveRateCard,
        updateLocationEmails,
        updateLocationCoords,
        getRateCardForLocation,
        refreshRateCards,
    generateInvoice,
    generateBusinessInvoices,
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
        refreshData,
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
