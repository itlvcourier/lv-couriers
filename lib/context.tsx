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
  failDelivery: (deliveryId: string, reason: FailReason) => void
  flagDelivery: (deliveryId: string, type: DeliveryFlag['type'], note: string, photoUrl: string | null) => void
  resolveFlag: (deliveryId: string, flagId: string, action: 'proceed' | 'cancel' | 'modify') => void
  postDelivery: (data: Partial<Delivery>) => void
  reassignDriver: (deliveryId: string, newDriverId: string) => void
  
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

  const failDelivery = useCallback((deliveryId: string, reason: FailReason) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: 'failed_retry' as DeliveryStatus,
          retryCount: d.retryCount + 1,
          statusHistory: [
            ...d.statusHistory,
            {
              status: 'failed_retry' as DeliveryStatus,
              timestamp: new Date().toISOString(),
              note: reason,
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
      recipientPhone: data.recipientPhone || null,
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
          regular: rateCardData.regular ?? 9,
          bigDouble: rateCardData.bigDouble ?? 18,
          outOfTownBig: rateCardData.outOfTownBig ?? 0,
          rush: rateCardData.rush ?? 20,
          rushOutOfTown: rateCardData.rushOutOfTown ?? 30,
          applyGst: rateCardData.applyGst ?? true,
          cancellationBeforeDepart: rateCardData.cancellationBeforeDepart ?? 0,
          cancellationEnRoute: rateCardData.cancellationEnRoute ?? 5,
          billingEmail: rateCardData.billingEmail || '',
          backupEmail: rateCardData.backupEmail || '',
          invoiceDueDays: rateCardData.invoiceDueDays ?? 15,
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
    const gstAmount = calculateGST(subtotal, rateCard.applyGst)
    const total = subtotal + gstAmount

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + rateCard.invoiceDueDays)

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
