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
  buildLabelData,
  printLabels,
  markLabelsPrinted,
  LABEL_SIZE_OPTIONS,
  type LabelSize,
} from '@/lib/labels'
import type { Delivery } from '@/lib/types'

// ============================================================================
// Reusable "Print label(s)" control for admin/business. Resolves each
// delivery's destination-zone color so labels carry the right color block,
// then opens the print dialog. The business chooses the print size (80mm
// receipt, 4x6" shipping label, or half-A4 sheet) from a dropdown.
// ============================================================================

interface LabelPrintButtonProps {
  deliveries: Delivery[]
  /** Initial/last-used size. Defaults to 4x6" shipping label. */
  defaultSize?: LabelSize
  label?: string
  variant?: 'solid' | 'outline'
  className?: string
  /** Called after a successful print (e.g. to refresh the printed indicator). */
  onPrinted?: (deliveryIds: string[]) => void
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

export function LabelPrintButton({
  deliveries,
  defaultSize = 'label4x6',
  label,
  variant = 'outline',
  className = '',
  onPrinted,
}: LabelPrintButtonProps) {
  const [busy, setBusy] = useState(false)
  const printable = deliveries.filter((d) => d.scanToken)

  const handlePrint = async (size: LabelSize) => {
    if (printable.length === 0) {
      toast.error('No labels to print yet. Labels are generated after zone assignment.')
      return
    }
    setBusy(true)
    try {
      const zoneMap = await resolveZones()
      const data = printable.map((d) => {
        const zone = d.dropoffZoneId ? zoneMap.get(d.dropoffZoneId) : null
        return buildLabelData(d, zone ? { name: zone.name, color: zone.color } : null)
      })
      await printLabels(data, size)
      // §11: record that these labels were printed (best-effort) and notify.
      const ids = printable.map((d) => d.id)
      void markLabelsPrinted(ids)
      onPrinted?.(ids)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to print labels')
    } finally {
      setBusy(false)
    }
  }

  const base =
    'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'
  const styles =
    variant === 'solid'
      ? 'bg-[var(--accent-orange)] text-white hover:opacity-90'
      : 'border border-[var(--border-color)] bg-[var(--bg-card)] text-foreground hover:bg-[var(--border-color)]/30'

  const text = label ?? (printable.length > 1 ? `Print ${printable.length} labels` : 'Print label')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={busy} className={`${base} ${styles} ${className}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          {text}
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
