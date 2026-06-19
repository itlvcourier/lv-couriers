'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Inbox,
  Check,
  X,
  Clock,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Truck,
  RotateCcw,
  Ban,
} from 'lucide-react'
import {
  type DispatchRequest,
  type DispatchRequestType,
  type DispatchRequestStatus,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  listDispatchRequests,
  approveDispatchRequest,
  rejectDispatchRequest,
} from '@/lib/dispatch-requests'

const TYPE_ICON: Record<DispatchRequestType, React.ElementType> = {
  late_order: Clock,
  address_change: MapPin,
  cancel: Ban,
  transfer: Truck,
  redelivery: RotateCcw,
}

const STATUS_VARIANT: Record<DispatchRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'default',
  approved: 'outline',
  auto_approved: 'outline',
  rejected: 'destructive',
  expired: 'secondary',
  cancelled: 'secondary',
}

type FilterTab = 'pending' | 'all'

export function ApprovalQueue() {
  const { currentUser, businesses } = useApp()
  const [requests, setRequests] = useState<DispatchRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const businessName = useCallback(
    (id: string | null) => (id ? businesses.find((b) => b.id === id)?.name ?? 'Unknown' : '—'),
    [businesses],
  )

  const load = useCallback(() => {
    setLoading(true)
    listDispatchRequests(tab === 'pending' ? { status: 'pending' } : { limit: 100 })
      .then(setRequests)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load requests'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  )

  const decide = async (req: DispatchRequest, action: 'approve' | 'reject') => {
    setBusyId(req.id)
    try {
      const reason = reasons[req.id]?.trim() || null
      if (action === 'approve') {
        await approveDispatchRequest(req.id, { decidedBy: currentUser?.id ?? null, reason })
        toast.success(`${REQUEST_TYPE_LABELS[req.type]} approved`)
      } else {
        await rejectDispatchRequest(req.id, { decidedBy: currentUser?.id ?? null, reason })
        toast.success(`${REQUEST_TYPE_LABELS[req.type]} rejected`)
      }
      setReasons((prev) => {
        const next = { ...prev }
        delete next[req.id]
        return next
      })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Approval Queue
              {pendingCount > 0 && <Badge variant="destructive">{pendingCount}</Badge>}
            </h3>
            <p className="text-sm text-muted-foreground">
              Late orders, address changes, cancellations, transfers, and redeliveries awaiting a decision.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setTab('pending')}
              className={`px-3 py-1.5 text-sm ${tab === 'pending' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 text-sm ${tab === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              All
            </button>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading requests…</CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-2">
            <Inbox className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {tab === 'pending' ? 'No pending requests' : 'No requests yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {tab === 'pending'
                ? 'New late orders and change requests will show up here.'
                : 'Requests will appear here as they are created.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const Icon = TYPE_ICON[req.type]
            const isPending = req.status === 'pending'
            const expiresSoon =
              isPending && req.expiresAt && new Date(req.expiresAt).getTime() - Date.now() < 15 * 60_000
            return (
              <Card key={req.id} className={isPending ? '' : 'opacity-80'}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                        <Icon className="w-4 h-4 text-foreground" />
                      </span>
                      {REQUEST_TYPE_LABELS[req.type]}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {businessName(req.businessId)}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {expiresSoon && (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Expiring
                        </Badge>
                      )}
                      <Badge variant={STATUS_VARIANT[req.status]}>{REQUEST_STATUS_LABELS[req.status]}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RequestDetails req={req} />

                  {(req.reason || !isPending) && (
                    <div className="text-xs text-muted-foreground">
                      {req.reason && <p>Note: {req.reason}</p>}
                      {!isPending && req.decidedAt && (
                        <p>Decided {new Date(req.decidedAt).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div className="space-y-2">
                      <Textarea
                        value={reasons[req.id] ?? ''}
                        onChange={(e) => setReasons((p) => ({ ...p, [req.id]: e.target.value }))}
                        placeholder="Optional note for this decision…"
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => decide(req, 'approve')}
                          disabled={busyId === req.id}
                        >
                          <Check className="w-4 h-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => decide(req, 'reject')}
                          disabled={busyId === req.id}
                        >
                          <X className="w-4 h-4 mr-1.5" />
                          Reject
                        </Button>
                        {req.expiresAt && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            Expires {new Date(req.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RequestDetails({ req }: { req: DispatchRequest }) {
  const p = req.payload ?? {}
  const rows: { label: string; value: string }[] = []
  const pushIf = (label: string, v: unknown) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') rows.push({ label, value: String(v) })
  }

  switch (req.type) {
    case 'late_order':
      pushIf('Cutoff', p.cutoffTime)
      pushIf('Posted at', p.postedLocal)
      pushIf('Recipient', p.recipientName)
      pushIf('Dropoff', p.dropoffAddress)
      break
    case 'address_change':
      pushIf('From', p.oldAddress)
      pushIf('To', p.newAddress)
      break
    case 'transfer':
      pushIf('From driver', p.fromDriverName)
      pushIf('To driver', p.toDriverName)
      break
    case 'redelivery':
      pushIf('Attempt', p.attempt)
      pushIf('Address', p.dropoffAddress)
      break
    case 'cancel':
      pushIf('Recipient', p.recipientName)
      pushIf('Dropoff', p.dropoffAddress)
      break
  }
  if (req.surchargeCode) rows.push({ label: 'Surcharge', value: String(req.surchargeCode) })

  if (rows.length === 0) return null
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-2">
          <span className="text-muted-foreground shrink-0">{r.label}:</span>
          <span className="text-foreground break-words">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
