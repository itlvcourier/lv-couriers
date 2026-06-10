'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeftRight,
  Check,
  X,
  Loader2,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import {
  listAllTransfers,
  setTransferAdminStatus,
  type DriverTransfer,
  type TransferStatus,
} from '@/lib/driver-transfers'
import { toast } from 'sonner'

const STATUS_TONE: Record<TransferStatus, string> = {
  pending: 'bg-[var(--accent-orange)]/15 text-[var(--accent-orange)]',
  accepted: 'bg-[var(--accent-green)]/15 text-[var(--accent-green)]',
  rejected: 'bg-[var(--accent-red)]/15 text-[var(--accent-red)]',
  cancelled: 'bg-muted text-muted-foreground',
}

export function AdminTransfers() {
  const transfersEnabled = useFeatureFlag('driver_transfers_enabled')
  const { currentUser } = useApp()
  const [transfers, setTransfers] = useState<DriverTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTransfers(await listAllTransfers())
    } catch (err) {
      console.error('[v0] load admin transfers error:', err)
      toast.error('Could not load transfers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const decide = async (transfer: DriverTransfer, adminStatus: 'approved' | 'rejected') => {
    setBusyId(transfer.id)
    try {
      await setTransferAdminStatus({
        transferId: transfer.id,
        adminStatus,
        approvedBy: currentUser?.id ?? null,
      })
      toast.success(adminStatus === 'approved' ? 'Transfer approved' : 'Transfer rejected')
      await load()
    } catch (err) {
      console.error('[v0] decide transfer error:', err)
      toast.error('Could not update transfer')
    } finally {
      setBusyId(null)
    }
  }

  if (!transfersEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <ArrowLeftRight className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Driver-to-driver transfers are turned off. Enable them in Settings to see this board.
        </p>
      </div>
    )
  }

  const awaitingApproval = transfers.filter(
    (t) => t.status === 'pending' && t.requiresAdmin && t.adminStatus !== 'approved' && t.adminStatus !== 'rejected',
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-[var(--accent-orange)]" />
          <h1 className="text-xl font-bold text-foreground">Driver transfers</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {awaitingApproval.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-orange)]">
            <ShieldAlert className="w-4 h-4" />
            Awaiting your approval ({awaitingApproval.length})
          </h2>
          <div className="space-y-2">
            {awaitingApproval.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-[var(--accent-orange)]/40 bg-[var(--bg-card)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t.fromDriverName ?? 'Driver'} → {t.toDriverName ?? 'open'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {t.transferCode} · {t.itemCount} parcel{t.itemCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[var(--accent-red)]"
                    disabled={busyId === t.id}
                    onClick={() => decide(t, 'rejected')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === t.id}
                    onClick={() => decide(t, 'approved')}
                  >
                    {busyId === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">All transfers</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No transfers yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-card)] text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">From → To</th>
                  <th className="px-4 py-2.5 font-medium">Parcels</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Initiated</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--border-color)]">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{t.transferCode}</td>
                    <td className="px-4 py-2.5 text-foreground">
                      {t.fromDriverName ?? 'Driver'} → {t.toDriverName ?? 'open'}
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{t.itemCount}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={`${STATUS_TONE[t.status]} border-0 font-medium`}>
                        {t.status}
                      </Badge>
                      {t.requiresAdmin && t.adminStatus && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (admin: {t.adminStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(t.initiatedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
