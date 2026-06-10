'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Printer, Loader2 } from 'lucide-react'
import { getZones, type Zone } from '@/lib/zones'
import { buildLabelData, printLabels } from '@/lib/labels'
import type { Delivery } from '@/lib/types'

// ============================================================================
// Reusable "Print label(s)" control for admin/business. Resolves each
// delivery's destination-zone color so labels carry the right color block,
// then opens the print dialog (4x6 thermal for one, Avery sheet for batches).
// ============================================================================

interface LabelPrintButtonProps {
  deliveries: Delivery[]
  /** thermal = one 4x6 per page; sheet = Avery grid (default for batches). */
  mode?: 'thermal' | 'sheet'
  label?: string
  variant?: 'solid' | 'outline'
  className?: string
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
  mode,
  label,
  variant = 'outline',
  className = '',
}: LabelPrintButtonProps) {
  const [busy, setBusy] = useState(false)
  const printable = deliveries.filter((d) => d.scanToken)

  const handlePrint = async () => {
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
      const printMode = mode ?? (data.length > 1 ? 'sheet' : 'thermal')
      await printLabels(data, printMode)
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

  return (
    <button onClick={handlePrint} disabled={busy} className={`${base} ${styles} ${className}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      {label ?? (printable.length > 1 ? `Print ${printable.length} labels` : 'Print label')}
    </button>
  )
}
