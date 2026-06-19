'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Printer, Loader2, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getZones, type Zone } from '@/lib/zones'
import {
  buildLabelDataFromRow,
  printLabels,
  LABEL_SIZE_OPTIONS,
  type LabelSize,
} from '@/lib/labels'

// ============================================================================
// Label print button for the admin orders list, which works with the
// snake_case DbDelivery row shape (joined business/driver). The print size
// (80mm receipt / 4x6" label / half-A4) is chosen from a dropdown.
// ============================================================================

interface Row {
  id: string
  scan_token?: string | null
  recipient_name?: string | null
  recipient_phone?: string | null
  dropoff_address?: string | null
  dropoff_area?: string | null
  dropoff_postal_code?: string | null
  dropoff_zone_id?: string | null
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
}

interface OrderLabelPrintProps {
  rows: Row[]
  defaultSize?: LabelSize
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

export function OrderLabelPrint({ rows, label, size = 'sm' }: OrderLabelPrintProps) {
  const [busy, setBusy] = useState(false)
  const printable = rows.filter((r) => r.scan_token)

  const handlePrint = async (labelSize: LabelSize) => {
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
      await printLabels(data, labelSize)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to print labels')
    } finally {
      setBusy(false)
    }
  }

  const h = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] font-medium text-foreground hover:bg-[var(--border-color)]/30 transition-colors disabled:opacity-50 ${h}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          {label ?? (printable.length > 1 ? `Print ${printable.length}` : 'Label')}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Choose print size</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LABEL_SIZE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            disabled={busy}
            onClick={() => handlePrint(opt.value)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
