'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/context'
import { useQrScanner } from '@/lib/hooks/useQrScanner'
import { useScanSync } from '@/lib/hooks/useScanSync'
import {
  applyScan,
  parseScanPayload,
  type ScanContext,
  type ScanOutcome,
} from '@/lib/scanning'
import type { Delivery } from '@/lib/types'
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  List,
  CloudOff,
  RefreshCw,
  PackageCheck,
} from 'lucide-react'

interface ScannerProps {
  /** What the scan means on this screen. */
  context: ScanContext
  /** Restrict the manual-fallback list to these deliveries. */
  candidates?: Delivery[]
  /** Holder the parcel moves to (e.g. `driver:<id>`, `hub`). */
  toHolder?: string | null
  /** Whether manual fallback is allowed (driven by barcode_scanning_required). */
  allowManual?: boolean
  /** Called after any successful scan/manual event is recorded or queued. */
  onScanned?: (delivery: Delivery, outcome: ScanOutcome) => void
  title?: string
}

type Feedback =
  | { tone: 'success'; title: string; lines: string[]; color?: string }
  | { tone: 'warning'; title: string; lines: string[] }
  | { tone: 'error'; title: string; lines: string[] }
  | null

const CONTEXT_LABEL: Record<ScanContext, string> = {
  pickup: 'Pickup scan',
  hub_sort: 'Sort to bin',
  hub_accept: 'Accept parcel',
  delivery: 'Delivery scan',
}

function beep(ok: boolean) {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = ok ? 880 : 220
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3))
    osc.onended = () => ctx.close()
  } catch {
    /* audio not available */
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ok ? 60 : [80, 60, 80])
  }
}

export function Scanner({
  context,
  candidates = [],
  toHolder = null,
  allowManual = true,
  onScanned,
  title,
}: ScannerProps) {
  const { currentUser } = useApp()
  const actorId = currentUser?.driverId || currentUser?.id || null
  const actorType: 'driver' | 'admin' = currentUser?.role === 'admin' ? 'admin' : 'driver'

  const { pending, online, flushNow } = useScanSync()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [scannedCount, setScannedCount] = useState(0)
  const busyRef = useRef(false)

  const handleToken = useCallback(
    async (rawText: string, method: 'qr' | 'manual', token?: string) => {
      if (busyRef.current) return
      const scanToken = token ?? parseScanPayload(rawText)
      if (!scanToken) {
        beep(false)
        setFeedback({ tone: 'error', title: 'Not a DOMS label', lines: ['That code is not recognized.'] })
        return
      }
      busyRef.current = true
      setBusy(true)

      // Best-effort GPS for the custody event.
      let lat: number | null = null
      let lng: number | null = null
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude
              lng = pos.coords.longitude
              resolve()
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 2500, maximumAge: 30_000 },
          )
        })
      }

      const outcome = await applyScan({
        context,
        scanToken,
        actorType,
        actorId,
        toHolder,
        lat,
        lng,
        scanMethod: method,
      })

      switch (outcome.kind) {
        case 'ok': {
          beep(true)
          setScannedCount((n) => n + 1)
          const d = outcome.delivery
          setFeedback({
            tone: 'success',
            title: outcome.queued ? 'Saved (offline)' : CONTEXT_LABEL[context],
            color: undefined,
            lines: [
              d.recipientName || d.dropoffArea || d.id.slice(0, 8),
              d.dropoffAddress || '',
              outcome.queued ? 'Will sync when back online' : '',
            ].filter(Boolean),
          })
          onScanned?.(d, outcome)
          break
        }
        case 'unknown_token':
          beep(false)
          setFeedback({ tone: 'error', title: 'Not a DOMS label', lines: ['No parcel matches this code.'] })
          break
        case 'already_done':
          beep(false)
          setFeedback({ tone: 'warning', title: 'Already done', lines: [outcome.message] })
          onScanned?.(outcome.delivery, outcome)
          break
        case 'wrong_stage':
          beep(false)
          setFeedback({ tone: 'warning', title: 'Wrong stage', lines: [outcome.message] })
          break
        case 'error':
          beep(false)
          setFeedback({ tone: 'error', title: 'Scan failed', lines: [outcome.message] })
          break
      }

      // Brief lock so the same parcel isn't re-read instantly.
      setTimeout(() => {
        busyRef.current = false
        setBusy(false)
      }, 900)
    },
    [context, actorType, actorId, toHolder, onScanned],
  )

  const { videoRef, active, error, start, stop } = useQrScanner({
    onDecode: (text) => void handleToken(text, 'qr'),
    paused: busy || manualOpen,
  })

  useEffect(() => {
    void start()
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remainingCandidates = candidates.filter(
    (d) => d.legStatus !== 'delivered',
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header / status row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title ?? CONTEXT_LABEL[context]}</h2>
          <p className="text-sm text-muted-foreground">
            {scannedCount > 0 ? `${scannedCount} scanned this session` : 'Point the camera at a label'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-orange)]">
              <CloudOff className="w-4 h-4" /> Offline
            </span>
          )}
          {pending > 0 && (
            <button
              onClick={() => void flushNow()}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)]"
            >
              <RefreshCw className="w-4 h-4" /> {pending} pending sync
            </button>
          )}
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative aspect-square w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        {/* Reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-2/3 aspect-square rounded-2xl border-4 border-white/80 shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]" />
        </div>

        {/* Confirmation overlay */}
        {feedback && (
          <button
            onClick={() => setFeedback(null)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{
              background:
                feedback.tone === 'success'
                  ? 'var(--accent-green)'
                  : feedback.tone === 'warning'
                    ? 'var(--accent-orange)'
                    : 'var(--accent-red)',
            }}
            aria-live="assertive"
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="w-16 h-16 text-white" />
            ) : feedback.tone === 'warning' ? (
              <AlertTriangle className="w-16 h-16 text-white" />
            ) : (
              <XCircle className="w-16 h-16 text-white" />
            )}
            <div className="text-2xl font-extrabold text-white">{feedback.title}</div>
            <div className="space-y-0.5">
              {feedback.lines.map((l, i) => (
                <div key={i} className="text-white/90 text-sm font-medium">
                  {l}
                </div>
              ))}
            </div>
            <span className="mt-2 text-white/80 text-xs">Tap to continue</span>
          </button>
        )}

        {!active && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Camera className="w-10 h-10" />
            <span className="text-sm">Starting camera…</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-4 py-3 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      )}

      {/* Manual fallback */}
      {allowManual && (
        <button
          onClick={() => setManualOpen((v) => !v)}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-foreground font-medium"
        >
          <List className="w-4 h-4" />
          {manualOpen ? 'Hide list' : "Can't scan? Pick from list"}
        </button>
      )}

      {manualOpen && allowManual && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] divide-y divide-[var(--border-color)] max-h-80 overflow-y-auto">
          {remainingCandidates.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No parcels available to select.
            </div>
          )}
          {remainingCandidates.map((d) => (
            <button
              key={d.id}
              disabled={busy}
              onClick={() => {
                if (d.scanToken) void handleToken(d.scanToken, 'manual', d.scanToken)
                else setFeedback({ tone: 'error', title: 'No label', lines: ['This parcel has no scan token yet.'] })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-50"
            >
              <PackageCheck className="w-5 h-5 text-[var(--accent-blue)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">
                  {d.recipientName || d.dropoffArea || d.id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground truncate">{d.dropoffAddress}</div>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{d.scanToken ?? '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
