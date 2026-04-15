import type { ManifestItem, RateCard, Delivery, InvoiceLine, Invoice } from './types'

/**
 * Calculate the rate for a delivery based on priority order:
 * 1. Rush + out of town -> Rush OOT rate
 * 2. Rush only -> Rush rate
 * 3. 2+ big packages + out of town -> OOT big rate
 * 4. 2+ big packages in town -> 2+ big rate
 * 5. Everything else -> Regular rate
 */
export function calculateRate(
  manifest: ManifestItem[],
  isOutOfTown: boolean,
  isRush: boolean,
  rateCard: RateCard
): number {
  // Priority 1: Rush + out of town
  if (isRush && isOutOfTown) return rateCard.rushOutOfTown

  // Priority 2: Rush only
  if (isRush) return rateCard.rush

  // Count big packages (use confirmed qty if available, otherwise posted qty)
  const bigCount = manifest
    .filter(i => i.type === 'big_package')
    .reduce((sum, i) => sum + (i.confirmedQty ?? i.postedQty), 0)

  // Priority 3: 2+ big packages + out of town
  if (bigCount >= 2 && isOutOfTown) return rateCard.outOfTownBig

  // Priority 4: 2+ big packages in town
  if (bigCount >= 2) return rateCard.bigDouble

  // Priority 5: Everything else (regular rate)
  return rateCard.regular
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
  isRush: boolean
): InvoiceLine['deliveryType'] {
  if (isRush && isOutOfTown) return 'rush_out_of_town'
  if (isRush) return 'rush'

  const bigCount = manifest
    .filter(i => i.type === 'big_package')
    .reduce((sum, i) => sum + (i.confirmedQty ?? i.postedQty), 0)

  if (bigCount >= 2 && isOutOfTown) return 'out_of_town_big'
  if (bigCount >= 2) return 'big_double'

  return 'regular'
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
    case 'regular': return rateCard.regular
    case 'big_double': return rateCard.bigDouble
    case 'out_of_town_big': return rateCard.outOfTownBig
    case 'rush': return rateCard.rush
    case 'rush_out_of_town': return rateCard.rushOutOfTown
    case 'cancellation': return rateCard.cancellationEnRoute
    default: return rateCard.regular
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
    const type = getDeliveryType(delivery.manifest, delivery.isOutOfTown, delivery.isUrgent)
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
    // Use default rates if no rate card
    return { rate: 9, gst: 0.45, total: 9.45 }
  }

  const rate = calculateRate(manifest, isOutOfTown, isRush, rateCard)
  const gst = calculateGST(rate, rateCard.applyGst)
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
