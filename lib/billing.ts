import type { ManifestItem, RateCard, Delivery, InvoiceLine, Invoice } from './types'

/**
 * Default rate card values applied when a business or location is created
 * without explicit overrides. Matches FreshMart's Shawnessy card (the baseline
 * referenced in the verification spec) so every location has sane defaults
 * from day one — no $0 estimates, no hardcoded fallbacks elsewhere.
 */
export const DEFAULT_RATE_CARD_VALUES = {
  rateRegular: 9,
  rateBigDouble: 18,
  rateOotBig: 25,
  rateRush: 20,
  rateRushOot: 30,
  gstApplicable: true,
  cancelBeforeDepart: 0,
  cancelEnRoute: 5,
  notifyDriverAssigned: true,
  notifyPickupConfirmed: true,
  notifyEnRoute: true,
  notifyDelivered: true,
  notifyFailed: true,
  notifyInvoiceSent: true,
  notifyPaymentReminder: true,
  notifyRecipientSms: true,
} as const

/**
 * Returns the price to display for a delivery in any list or summary context.
 * Priority:
 *   1. `calculatedRate` — locked in by PickupVerification once a driver confirms.
 *   2. Live estimate from the location's rate card using posted quantities.
 *   3. 0 when no rate card exists yet (UI should flag this separately).
 */
export function estimateDeliveryPrice(delivery: Delivery, rateCard: RateCard | null): number {
  if (delivery.calculatedRate != null) return delivery.calculatedRate
  if (!rateCard) return 0
  return calculateRate(delivery.manifest, delivery.isOutOfTown, delivery.isUrgent, rateCard, false)
}

/**
 * Count big packages in a manifest.
 * - `useConfirmed: false` (default) → always use postedQty (for estimates, pre-pickup).
 * - `useConfirmed: true` → use confirmedQty when it is not null (post-pickup); otherwise
 *   fall back to postedQty. Note: `confirmedQty === 0` is treated as an explicit zero,
 *   NOT a fallback to posted.
 */
export function countBigPackages(
  manifest: ManifestItem[],
  useConfirmed: boolean = false
): number {
  return manifest
    .filter(i => i.type === 'big_package')
    .reduce((sum, i) => {
      const qty = useConfirmed && i.confirmedQty !== null ? i.confirmedQty : i.postedQty
      return sum + qty
    }, 0)
}

/**
 * Calculate the rate for a delivery based on priority order:
 * 1. Rush + out of town -> Rush OOT rate
 * 2. Rush only -> Rush rate
 * 3. 2+ big packages + out of town (not rush) -> OOT big rate
 * 4. 2+ big packages in town (not rush) -> 2+ big rate
 * 5. Everything else -> Regular rate
 *
 * Rush always overrides package count. Out-of-town only affects price when
 * combined with rush OR with 2+ big packages.
 *
 * Pass `useConfirmed: true` after pickup verification to lock the rate against
 * the driver-confirmed quantities.
 */
export function calculateRate(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  rateCard: RateCard,
  useConfirmed: boolean = false
): number {
  // Priority 1: Rush + Out of Town
  if (isRush && isOutOfTown) return rateCard.rateRushOot

  // Priority 2: Rush only (in town)
  if (isRush) return rateCard.rateRush

  const bigCount = countBigPackages(manifest, useConfirmed)

  // Priority 3: 2+ big packages + out of town (not rush)
  if (bigCount >= 2 && isOutOfTown) return rateCard.rateOotBig ?? rateCard.rateBigDouble

  // Priority 4: 2+ big packages in town (not rush)
  if (bigCount >= 2) return rateCard.rateBigDouble

  // Priority 5: Everything else
  return rateCard.rateRegular
}

/**
 * Human-readable rule name returned by calculateRate for the given inputs.
 * Matches the exact labels used in the verification spec and the UI.
 */
export type BillingRuleName =
  | 'Regular'
  | 'Rush'
  | 'Rush + Out of Town'
  | '2+ Big Packages — In Town'
  | '2+ Big Packages — Out of Town'

export function getRuleApplied(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  useConfirmed: boolean = false
): BillingRuleName {
  if (isRush && isOutOfTown) return 'Rush + Out of Town'
  if (isRush) return 'Rush'
  const bigCount = countBigPackages(manifest, useConfirmed)
  if (bigCount >= 2 && isOutOfTown) return '2+ Big Packages — Out of Town'
  if (bigCount >= 2) return '2+ Big Packages — In Town'
  return 'Regular'
}

/**
 * Calculate GST amount (5%)
 */
export function calculateGST(amount: number, applicable: boolean): number {
  if (!applicable) return 0
  return Math.round(amount * 0.05 * 100) / 100
}

/**
 * Get the delivery type category for a delivery
 */
export function getDeliveryType(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  useConfirmed: boolean = false
): InvoiceLine['deliveryType'] {
  if (isRush && isOutOfTown) return 'rush_out_of_town'
  if (isRush) return 'rush'

  const bigCount = countBigPackages(manifest, useConfirmed)

  if (bigCount >= 2 && isOutOfTown) return 'out_of_town_big'
  if (bigCount >= 2) return 'big_double'

  return 'regular'
}

/**
 * Rule-to-badge-color mapping for UI components.
 */
export function getRuleBadgeColor(rule: BillingRuleName): 'red' | 'orange' | 'purple' | 'blue' | 'gray' {
  switch (rule) {
    case 'Rush + Out of Town': return 'red'
    case 'Rush': return 'orange'
    case '2+ Big Packages — Out of Town': return 'purple'
    case '2+ Big Packages — In Town': return 'blue'
    case 'Regular':
    default: return 'gray'
  }
}

/**
 * Full billing breakdown for display. Handles null rate cards gracefully.
 */
export function calculateBreakdown(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  rateCard: RateCard | null,
  useConfirmed: boolean = false
): {
  rule: BillingRuleName
  rate: number
  gst: number
  total: number
  bigPackageCount: number
  gstApplicable: boolean
} {
  const rule = getRuleApplied(manifest, isOutOfTown, isRush, useConfirmed)
  const bigPackageCount = countBigPackages(manifest, useConfirmed)
  if (!rateCard) {
    return { rule, rate: 0, gst: 0, total: 0, bigPackageCount, gstApplicable: false }
  }
  const rate = calculateRate(manifest, isOutOfTown, isRush, rateCard, useConfirmed)
  const gst = calculateGST(rate, rateCard.gstApplicable)
  const total = calculateTotal(rate, gst)
  return { rule, rate, gst, total, bigPackageCount, gstApplicable: rateCard.gstApplicable }
}

/**
 * Total = rate + GST rounded to 2 decimal places.
 */
export function calculateTotal(rate: number, gst: number): number {
  return Math.round((rate + gst) * 100) / 100
}

/**
 * Get human-readable description for delivery type
 */
export function getDeliveryTypeLabel(type: InvoiceLine['deliveryType']): string {
  switch (type) {
    case 'regular': return 'Regular deliveries'
    case 'big_double': return '2+ big packages'
    case 'out_of_town_big': return 'Out of town 2+ big'
    case 'rush': return 'Rush deliveries'
    case 'rush_out_of_town': return 'Rush + out of town'
    case 'cancellation': return 'Cancellation fees'
    default: return 'Other'
  }
}

/**
 * Get the rate for a delivery type from rate card
 */
export function getRateForType(type: InvoiceLine['deliveryType'], rateCard: RateCard): number {
  switch (type) {
    case 'regular': return rateCard.rateRegular
    case 'big_double': return rateCard.rateBigDouble
    case 'out_of_town_big': return rateCard.rateOotBig ?? rateCard.rateBigDouble
    case 'rush': return rateCard.rateRush
    case 'rush_out_of_town': return rateCard.rateRushOot
    case 'cancellation': return rateCard.cancelEnRoute ?? 0
    default: return rateCard.rateRegular
  }
}

/**
 * Calculate invoice lines from completed deliveries
 */
export function calculateInvoiceLines(
  deliveries: Delivery[],
  rateCard: RateCard
): InvoiceLine[] {
  // Group deliveries by type
  const groups: Record<InvoiceLine['deliveryType'], { ids: string[]; count: number }> = {
    regular: { ids: [], count: 0 },
    big_double: { ids: [], count: 0 },
    out_of_town_big: { ids: [], count: 0 },
    rush: { ids: [], count: 0 },
    rush_out_of_town: { ids: [], count: 0 },
    cancellation: { ids: [], count: 0 },
  }

  // Only count completed deliveries
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered')

  completedDeliveries.forEach(delivery => {
    // Completed deliveries use driver-confirmed quantities.
    const type = getDeliveryType(delivery.manifest, delivery.isOutOfTown, delivery.isUrgent, true)
    groups[type].ids.push(delivery.id)
    groups[type].count++
  })

  // Build line items
  const lines: InvoiceLine[] = []

  Object.entries(groups).forEach(([type, data]) => {
    if (data.count > 0) {
      const deliveryType = type as InvoiceLine['deliveryType']
      const rate = getRateForType(deliveryType, rateCard)
      lines.push({
        id: `line-${Date.now()}-${type}`,
        description: getDeliveryTypeLabel(deliveryType),
        deliveryType,
        quantity: data.count,
        rate,
        total: data.count * rate,
        deliveryIds: data.ids,
      })
    }
  })

  return lines
}

/**
 * Generate a new invoice number
 */
export function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const maxNumber = existingInvoices.reduce((max, inv) => {
    const num = parseInt(inv.invoiceNumber.replace('INV-', ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
  return `INV-${maxNumber + 1}`
}

/**
 * Calculate estimated cost for a delivery before posting
 */
export function calculateEstimatedCost(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  rateCard: RateCard | null
): { rate: number; gst: number; total: number } {
  if (!rateCard) {
    // No rate card set — callers must handle this state explicitly (e.g. warn).
    return { rate: 0, gst: 0, total: 0 }
  }

  const rate = calculateRate(manifest, isOutOfTown, isRush, rateCard)
  const gst = calculateGST(rate, rateCard.gstApplicable)
  return { rate, gst, total: rate + gst }
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid') return false
  return new Date(invoice.dueDate) < new Date()
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

/**
 * Get reminder schedule based on settings
 */
export function getReminderSchedule(dueDate: string, settings: { reminderDay1: number; overdueDay: number; escalationDay: number }) {
  const due = new Date(dueDate)
  
  const reminder1 = new Date(due)
  reminder1.setDate(reminder1.getDate() - settings.reminderDay1)
  
  const overdueDate = new Date(due)
  overdueDate.setDate(overdueDate.getDate() + settings.overdueDay)
  
  const escalationDate = new Date(due)
  escalationDate.setDate(escalationDate.getDate() + settings.overdueDay + settings.escalationDay)

  return {
    reminder1: reminder1.toISOString(),
    dueDate: due.toISOString(),
    overdueDate: overdueDate.toISOString(),
    escalationDate: escalationDate.toISOString(),
  }
}
