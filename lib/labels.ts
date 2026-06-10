'use client'

import QRCode from 'qrcode'
import type { Delivery } from '@/lib/types'

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
  address: string
  zoneName: string | null
  zoneColor: string | null
  driverInitials: string | null
  businessName: string
  isRush: boolean
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
  return {
    scanToken: delivery.scanToken ?? '',
    orderShortId: delivery.id.slice(0, 8).toUpperCase(),
    recipientName: delivery.recipientName ?? '—',
    address: delivery.dropoffAddress || delivery.dropoffArea || '—',
    zoneName: zone?.name ?? null,
    zoneColor: zone?.color ?? null,
    driverInitials: initialsFromName(delivery.driverName),
    businessName: delivery.businessName || '',
    isRush: !!delivery.isRush || !!delivery.isUrgent,
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
    dropoff_address?: string | null
    dropoff_area?: string | null
    is_rush?: boolean | null
    is_urgent?: boolean | null
    business?: { name?: string | null } | null
    driver?: { name?: string | null } | null
  },
  zone?: { name: string; color: string } | null,
): LabelData {
  return {
    scanToken: row.scan_token ?? '',
    orderShortId: row.id.slice(0, 8).toUpperCase(),
    recipientName: row.recipient_name ?? '—',
    address: row.dropoff_address || row.dropoff_area || '—',
    zoneName: zone?.name ?? null,
    zoneColor: zone?.color ?? null,
    driverInitials: initialsFromName(row.driver?.name),
    businessName: row.business?.name ?? '',
    isRush: !!row.is_rush || !!row.is_urgent,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A single label's inner HTML, sharing print CSS classes. */
function labelInnerHtml(d: LabelData, qrDataUrl: string): string {
  const color = d.zoneColor || '#64748b'
  const zoneName = d.zoneName ? escapeHtml(d.zoneName) : 'Unzoned'
  return `
    <div class="label">
      <div class="label-top">
        <img class="qr" src="${qrDataUrl}" alt="QR for ${escapeHtml(d.scanToken)}" />
        <div class="label-meta">
          <div class="token">${escapeHtml(d.scanToken)}</div>
          <div class="order">#${escapeHtml(d.orderShortId)}</div>
          ${d.isRush ? '<div class="rush">RUSH</div>' : ''}
        </div>
      </div>
      <div class="zone-block" style="background:${color}">
        <span class="zone-name">${zoneName}</span>
        ${d.driverInitials ? `<span class="driver">${escapeHtml(d.driverInitials)}</span>` : ''}
      </div>
      <div class="label-body">
        <div class="recipient">${escapeHtml(d.recipientName)}</div>
        <div class="address">${escapeHtml(d.address)}</div>
        <div class="biz">${escapeHtml(d.businessName)}</div>
      </div>
    </div>`
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; color: #0f172a; }
  .label {
    border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;
    display: flex; flex-direction: column; background: #fff;
    width: 4in; height: 6in; page-break-after: always; padding: 0.18in;
  }
  .label-top { display: flex; gap: 0.18in; align-items: flex-start; }
  .qr { width: 1.7in; height: 1.7in; }
  .label-meta { display: flex; flex-direction: column; gap: 4px; }
  .token { font-size: 22pt; font-weight: 800; letter-spacing: 1px; }
  .order { font-size: 12pt; color: #475569; }
  .rush { display: inline-block; background: #dc2626; color: #fff; font-weight: 800;
          padding: 2px 8px; border-radius: 4px; font-size: 11pt; width: max-content; }
  .zone-block { margin: 0.12in 0; padding: 0.12in 0.16in; border-radius: 6px;
                color: #fff; display: flex; justify-content: space-between; align-items: center; }
  .zone-name { font-size: 16pt; font-weight: 800; text-transform: uppercase; }
  .driver { font-size: 16pt; font-weight: 800; background: rgba(0,0,0,0.25); padding: 2px 10px; border-radius: 4px; }
  .label-body { display: flex; flex-direction: column; gap: 4px; }
  .recipient { font-size: 18pt; font-weight: 700; }
  .address { font-size: 13pt; color: #334155; }
  .biz { font-size: 11pt; color: #64748b; margin-top: auto; }

  /* Avery-style sheet: 2 columns x 3 rows on Letter */
  .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2in; padding: 0.3in; }
  .sheet .label { width: auto; height: 3.4in; page-break-after: auto; }
  .sheet .qr { width: 1.2in; height: 1.2in; }
  .sheet .token { font-size: 16pt; }
  .sheet .recipient { font-size: 13pt; }
  .sheet .address { font-size: 10pt; }
  @page { margin: 0; }
`

async function buildLabelsHtml(
  labels: LabelData[],
  mode: 'thermal' | 'sheet',
): Promise<string> {
  const withQr = await Promise.all(
    labels.map(async (d) => ({ d, qr: await generateQrDataUrl(d.scanToken) })),
  )
  const body = withQr.map(({ d, qr }) => labelInnerHtml(d, qr)).join('\n')
  const wrapped = mode === 'sheet' ? `<div class="sheet">${body}</div>` : body
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>${PRINT_CSS}</style></head><body>${wrapped}</body></html>`
}

/**
 * Open a print window for one or many labels. `mode='thermal'` = one 4x6 per
 * page; `mode='sheet'` = Avery-style grid for batch printing.
 */
export async function printLabels(
  labels: LabelData[],
  mode: 'thermal' | 'sheet' = 'thermal',
): Promise<void> {
  if (labels.length === 0) return
  const html = await buildLabelsHtml(labels, mode)
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
