'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Printer, Loader2 } from 'lucide-react'
import { getZones, type Zone } from '@/lib/zones'
import { buildLabelDataFromRow, printLabels } from '@/lib/labels'

// ============================================================================
// Label print button for the admin orders list, which works with the
// snake_case DbDelivery row shape (joined business/driver).
// ============================================================================

interface Row {
  id: string
  scan_token?: string | null
  recipient_name?: string | null
  dropoff_address?: string | null
  dropoff_area?: string | null
  dropoff_zone_id?: string | null
  is_rush?: boolean | null
  is_urgent?: boolean | null
  business?: { name?: string | null } | null
  driver?: { name?: string | null } | null
}

interface OrderLabelPrintProps {
  rows: Row[]
  mode?: 'thermal' | 'sheet'
  label?: string
  size?: 'sm' | 'md'
}

let zoneCache: Zone[] | null = null
async function resolveZones(): Promise<Map<string, Zone>> {
  if (!zoneCache) {
    try {
      zoneCache = await getZones(true)
    } catch {
      zoneCache = []
    }
  }
  return new Map(zoneCache.map((z) => [z.id, z]))
}

export function OrderLabelPrint({ rows, mode, label, size = 'sm' }: OrderLabelPrintProps) {
  const [busy, setBusy] = useState(false)
  const printable = rows.filter((r) => r.scan_token)

  const handlePrint = async () => {
    if (printable.length === 0) {
      toast.error('No labels yet — labels are generated after zone assignment.')
      return
    }
    setBusy(true)
    try {
      const zoneMap = await resolveZones()
      const data = printable.map((r) => {
        const zone = r.dropoff_zone_id ? zoneMap.get(r.dropoff_zone_id) : null
        return buildLabelDataFromRow(r, zone ? { name: zone.name, color: zone.color } : null)
      })
      await printLabels(data, mode ?? (data.length > 1 ? 'sheet' : 'thermal'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to print labels')
    } finally {
      setBusy(false)
    }
  }

  const h = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void handlePrint()
      }}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] font-medium text-foreground hover:bg-[var(--border-color)]/30 transition-colors disabled:opacity-50 ${h}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      {label ?? (printable.length > 1 ? `Print ${printable.length}` : 'Label')}
    </button>
  )
}
