'use client'

import QRCode from 'qrcode'
import type { Delivery } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

/**
 * Stamp deliveries as having had their label printed (§11). Best-effort: a
 * failure here must not block the print itself.
 */
export async function markLabelsPrinted(deliveryIds: string[]): Promise<void> {
  if (deliveryIds.length === 0) return
  const supabase = createClient()
  if (!supabase) return
  await supabase
    .from('deliveries')
    .update({ label_printed_at: new Date().toISOString() })
    .in('id', deliveryIds)
}

// ============================================================================
// Phase 2 — Label generation.
//
// Each delivery's `scan_token` is encoded as a QR code. A printable label
// pairs that QR with human-readable order info + a destination zone color
// block + driver initials, so a sorter can route by color even without the app
// ("blue label -> blue bin"). Supports two print paths:
//   - 4x6 thermal/sticker (one per page)
//   - Avery-style label sheet (grid, batch)
// ============================================================================

export interface LabelData {
  scanToken: string
  orderShortId: string
  recipientName: string
  recipientPhone: string | null
  address: string
  postalCode: string | null
  buzzCode: string | null
  /** Sender pickup location (helps sorters/returns). */
  pickupAddress: string | null
  zoneName: string | null
  zoneColor: string | null
  driverInitials: string | null
  driverName: string | null
  businessName: string
  trackingCode: string | null
  isRush: boolean
  distanceKm: number | null
  pieces: number
  requireSignature: boolean
  requirePhoto: boolean
  createdAt: string | null
}

/** Print formats the business can choose from. */
export type LabelSize = 'receipt' | 'label4x6' | 'halfA4'

export const LABEL_SIZE_OPTIONS: { value: LabelSize; label: string; hint: string }[] = [
  { value: 'receipt', label: 'Receipt (80mm)', hint: 'Thermal receipt printers (pharmacy/POS)' },
  { value: 'label4x6', label: 'Shipping label (4×6")', hint: 'Thermal label / sticker printers' },
  { value: 'halfA4', label: 'Half A4 sheet', hint: 'Standard office printer, 2 per A4 page' },
]

/** Mask a phone for privacy on a printed surface: keep last 2 digits only. */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  const last = digits.slice(-2)
  return `(•••) •••-••${last}`
}

/** Encode a scan token as a QR data URL (PNG). */
export async function generateQrDataUrl(scanToken: string): Promise<string> {
  return QRCode.toDataURL(scanToken, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export function initialsFromName(name: string | null | undefined): string | null {
  if (!name) return null
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Build label data from a delivery + resolved zone metadata. */
export function buildLabelData(
  delivery: Delivery,
  zone?: { name: string; color: string } | null,
): LabelData {
  const pieces = Array.isArray(delivery.manifest)
    ? delivery.manifest.reduce((sum, m) => sum + (m.postedQty || 0), 0) || delivery.manifest.length
    : 0
  return {
    scanToken: delivery.scanToken ?? '',
    orderShortId: delivery.id.slice(0, 8).toUpperCase(),
    recipientName: delivery.recipientName ?? '—',
    recipientPhone: delivery.recipientPhone ?? null,
    address: delivery.dropoffAddress || delivery.dropoffArea || '—',
    postalCode: delivery.dropoffPostalCode ?? null,
    buzzCode: delivery.buzzCode ?? null,
    pickupAddress: delivery.pickupAddress || delivery.pickupArea || null,
    zoneName: zone?.name ?? null,
    zoneColor: zone?.color ?? null,
    driverInitials: initialsFromName(delivery.driverName),
    driverName: delivery.driverName ?? null,
    businessName: delivery.businessName || '',
    trackingCode: delivery.trackingCode ?? null,
    isRush: !!delivery.isRush || !!delivery.isUrgent,
    distanceKm: delivery.distanceKm ?? null,
    pieces: pieces || 1,
    requireSignature: !!delivery.requireSignature,
    requirePhoto: !!delivery.requirePhoto,
    createdAt: delivery.createdAt ?? delivery.postedAt ?? null,
  }
}

/**
 * Build label data from a snake_case delivery row (DbDelivery shape) so admin
 * order lists can print without mapping to the full Delivery type first.
 */
export function buildLabelDataFromRow(
  row: {
    id: string
    scan_token?: string | null
    recipient_name?: string | null
    recipient_phone?: string | null
    dropoff_address?: string | null
    dropoff_area?: string | null
    dropoff_postal_code?: string | null
    buzz_code?: string | null
    pickup_address?: string | null
    pickup_area?: string | null
    tracking_code?: string | null
    is_rush?: boolean | null
    is_urgent?: boolean | null
    distance_km?: number | null
    require_signature?: boolean | null
    require_photo?: boolean | null
    created_at?: string | null
    business?: { name?: string | null } | null
    driver?: { name?: string | null } | null
  },
  zone?: { name: string; color: string } | null,
): LabelData {
  return {
    scanToken: row.scan_token ?? '',
    orderShortId: row.id.slice(0, 8).toUpperCase(),
    recipientName: row.recipient_name ?? '—',
    recipientPhone: row.recipient_phone ?? null,
    address: row.dropoff_address || row.dropoff_area || '—',
    postalCode: row.dropoff_postal_code ?? null,
    buzzCode: row.buzz_code ?? null,
    pickupAddress: row.pickup_address || row.pickup_area || null,
    zoneName: zone?.name ?? null,
    zoneColor: zone?.color ?? null,
    driverInitials: initialsFromName(row.driver?.name),
    driverName: row.driver?.name ?? null,
    businessName: row.business?.name ?? '',
    trackingCode: row.tracking_code ?? null,
    isRush: !!row.is_rush || !!row.is_urgent,
    distanceKm: row.distance_km ?? null,
    pieces: 1,
    requireSignature: !!row.require_signature,
    requirePhoto: !!row.require_photo,
    createdAt: row.created_at ?? null,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * A single label's inner HTML. The same markup is reused across every size;
 * the print CSS for each size shows/hides and rescales the right pieces.
 * Recipient phone is masked for privacy on the printed surface.
 */
function labelInnerHtml(d: LabelData, qrDataUrl: string): string {
  const color = d.zoneColor || '#64748b'
  const zoneName = d.zoneName ? escapeHtml(d.zoneName) : 'Unzoned'
  const maskedPhone = maskPhone(d.recipientPhone)
  const created = fmtDate(d.createdAt)

  const captureFlags: string[] = []
  if (d.requireSignature) captureFlags.push('Signature')
  if (d.requirePhoto) captureFlags.push('Photo')

  const detailRows: string[] = []
  if (d.buzzCode) detailRows.push(`<div class="row"><span>Buzz/Unit</span><b>${escapeHtml(d.buzzCode)}</b></div>`)
  if (maskedPhone) detailRows.push(`<div class="row"><span>Contact</span><b>${escapeHtml(maskedPhone)}</b></div>`)
  if (d.distanceKm != null) detailRows.push(`<div class="row"><span>Distance</span><b>${d.distanceKm.toFixed(1)} km</b></div>`)
  detailRows.push(`<div class="row"><span>Pieces</span><b>${d.pieces}</b></div>`)
  if (captureFlags.length) detailRows.push(`<div class="row"><span>On delivery</span><b>${captureFlags.join(' + ')}</b></div>`)

  return `
    <div class="label">
      <header class="hdr">
        <div class="brand">
          <div class="biz">${escapeHtml(d.businessName || 'LV Courier')}</div>
          <div class="ship">SHIPPING LABEL${created ? ` · ${escapeHtml(created)}` : ''}</div>
        </div>
        ${d.isRush ? '<div class="rush">RUSH</div>' : ''}
      </header>

      <div class="zone-block" style="background:${color}">
        <span class="zone-name">${zoneName}</span>
        ${d.driverInitials ? `<span class="driver" title="${escapeHtml(d.driverName ?? '')}">${escapeHtml(d.driverInitials)}</span>` : '<span class="driver unassigned">—</span>'}
      </div>

      <div class="label-top">
        <img class="qr" src="${qrDataUrl}" alt="Scan code ${escapeHtml(d.scanToken)}" />
        <div class="label-meta">
          <div class="token-label">SCAN</div>
          <div class="token">${escapeHtml(d.scanToken)}</div>
          <div class="order">Order #${escapeHtml(d.orderShortId)}</div>
          ${d.trackingCode ? `<div class="track">Track: ${escapeHtml(d.trackingCode)}</div>` : ''}
        </div>
      </div>

      <div class="label-body">
        <div class="section-label">DELIVER TO</div>
        <div class="recipient">${escapeHtml(d.recipientName)}</div>
        <div class="address">${escapeHtml(d.address)}</div>
        ${d.postalCode ? `<div class="postal">${escapeHtml(d.postalCode)}</div>` : ''}
        <div class="details">${detailRows.join('')}</div>
        ${d.pickupAddress ? `<div class="from">FROM: ${escapeHtml(d.pickupAddress)}</div>` : ''}
      </div>

      <footer class="legal">
        Handle per privacy policy. Contains personal delivery info — do not photograph or share.
        Misdelivered? Return to LV Courier. lvcourier.ca
      </footer>
    </div>`
}

/** Shared label styling; per-size overrides live in SIZE_CSS. */
const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; margin: 0; padding: 0; color: #0f172a; }
  .label {
    border: 1px solid #cbd5e1; overflow: hidden; background: #fff;
    display: flex; flex-direction: column; gap: 0.08in; padding: 0.16in;
  }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 0.06in; }
  .brand .biz { font-size: 14pt; font-weight: 800; line-height: 1.1; }
  .brand .ship { font-size: 8pt; letter-spacing: 1.5px; color: #64748b; font-weight: 600; }
  .rush { background: #dc2626; color: #fff; font-weight: 800; padding: 3px 10px; border-radius: 4px; font-size: 12pt; letter-spacing: 1px; }
  .zone-block { padding: 0.08in 0.14in; border-radius: 5px; color: #fff;
                display: flex; justify-content: space-between; align-items: center; }
  .zone-name { font-size: 15pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .driver { font-size: 14pt; font-weight: 800; background: rgba(0,0,0,0.28); padding: 2px 10px; border-radius: 4px; }
  .driver.unassigned { background: rgba(0,0,0,0.18); }
  .label-top { display: flex; gap: 0.16in; align-items: center; }
  .qr { width: 1.5in; height: 1.5in; flex: none; }
  .label-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .token-label { font-size: 7pt; letter-spacing: 2px; color: #94a3b8; font-weight: 700; }
  .token { font-size: 20pt; font-weight: 800; letter-spacing: 1px; word-break: break-all; line-height: 1.05; }
  .order { font-size: 10pt; color: #475569; font-weight: 600; }
  .track { font-size: 9pt; color: #64748b; }
  .label-body { display: flex; flex-direction: column; gap: 2px; }
  .section-label { font-size: 7pt; letter-spacing: 2px; color: #94a3b8; font-weight: 700; }
  .recipient { font-size: 17pt; font-weight: 800; line-height: 1.1; }
  .address { font-size: 12pt; color: #1e293b; line-height: 1.25; }
  .postal { font-size: 11pt; color: #334155; font-weight: 600; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 0.16in; margin-top: 0.06in; }
  .details .row { display: flex; justify-content: space-between; font-size: 9pt; border-bottom: 1px dotted #e2e8f0; padding: 1px 0; }
  .details .row span { color: #64748b; }
  .details .row b { color: #0f172a; }
  .from { font-size: 8.5pt; color: #94a3b8; margin-top: 0.04in; }
  .legal { font-size: 6.5pt; color: #94a3b8; line-height: 1.3; border-top: 1px solid #e2e8f0; padding-top: 0.05in; margin-top: auto; }
`

/** Page geometry + size-specific scaling for each label format. */
const SIZE_CSS: Record<LabelSize, string> = {
  // 80mm thermal receipt roll. Narrow + tall, single column, compact type.
  receipt: `
    @page { size: 80mm auto; margin: 0; }
    body { width: 80mm; }
    .label { width: 80mm; border: none; page-break-after: always; padding: 4mm; }
    .qr { width: 32mm; height: 32mm; }
    .token { font-size: 16pt; }
    .recipient { font-size: 14pt; }
    .address { font-size: 11pt; }
    .details { grid-template-columns: 1fr; }
    .brand .biz { font-size: 12pt; }
  `,
  // 4x6 inch thermal shipping label / sticker, one per page.
  label4x6: `
    @page { size: 4in 6in; margin: 0; }
    .label { width: 4in; height: 6in; border: none; page-break-after: always; }
    .qr { width: 1.7in; height: 1.7in; }
  `,
  // Half of an A4 page (A5 landscape-ish): two labels stack per A4 sheet.
  halfA4: `
    @page { size: A4; margin: 0; }
    .label { width: 210mm; height: 148.5mm; page-break-after: always; padding: 12mm 16mm; gap: 0.14in; }
    .qr { width: 2.2in; height: 2.2in; }
    .brand .biz { font-size: 20pt; }
    .brand .ship { font-size: 10pt; }
    .zone-name { font-size: 20pt; }
    .driver { font-size: 18pt; }
    .token { font-size: 30pt; }
    .order { font-size: 13pt; }
    .recipient { font-size: 26pt; }
    .address { font-size: 17pt; }
    .postal { font-size: 15pt; }
    .details .row { font-size: 11pt; }
    .legal { font-size: 8pt; }
  `,
}

async function buildLabelsHtml(labels: LabelData[], size: LabelSize): Promise<string> {
  const withQr = await Promise.all(
    labels.map(async (d) => ({ d, qr: await generateQrDataUrl(d.scanToken) })),
  )
  const body = withQr.map(({ d, qr }) => labelInnerHtml(d, qr)).join('\n')
  const css = `${BASE_CSS}\n${SIZE_CSS[size]}`
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>${css}</style></head><body>${body}</body></html>`
}

/**
 * Open a print window for one or many labels in the chosen size:
 *   - 'receipt'  : 80mm thermal receipt roll (pharmacy/POS printers)
 *   - 'label4x6' : 4x6" thermal shipping label / sticker
 *   - 'halfA4'   : half an A4 page, two labels per sheet on an office printer
 */
export async function printLabels(
  labels: LabelData[],
  size: LabelSize = 'label4x6',
): Promise<void> {
  if (labels.length === 0) return
  const html = await buildLabelsHtml(labels, size)
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to print labels.')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  // Give images a tick to decode before printing.
  win.onload = () => {
    setTimeout(() => {
      win.focus()
      win.print()
    }, 250)
  }
}
