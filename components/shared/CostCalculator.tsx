'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Plus, Minus, X, Package, Box, Zap, MapPin, Info, Ruler } from 'lucide-react'
import { calculateBreakdown, getRuleBadgeColor, findMatchingTier, type BillingRuleName } from '@/lib/billing'
import type { ManifestItem, RateCard } from '@/lib/types'
import { cn } from '@/lib/utils'

type CalcItem = { id: string; kind: 'small_package' | 'big_package'; qty: number }

interface CostCalculatorProps {
  rateCard: RateCard | null
  rateCardLabel?: string
  compact?: boolean
}

export function CostCalculator({ rateCard, rateCardLabel, compact = false }: CostCalculatorProps) {
  const [items, setItems] = useState<CalcItem[]>([{ id: '1', kind: 'small_package', qty: 1 }])
  const [outOfTown, setOutOfTown] = useState(false)
  const [rush, setRush] = useState(false)
  const [distanceKm, setDistanceKm] = useState<number>(5)

  const isDistanceBased = rateCard?.useRadiusPricing && (rateCard.radiusTiers?.length ?? 0) > 0

  const manifest: ManifestItem[] = useMemo(() =>
    items.map(i => ({
      id: i.id,
      type: i.kind,
      postedQty: i.qty,
      confirmedQty: null,
      verificationPhotoUrl: null,
      notes: '',
    })),
    [items]
  )

  const breakdown = useMemo(
    () => calculateBreakdown(
      manifest, 
      isDistanceBased ? false : outOfTown, 
      rush, 
      rateCard, 
      false,
      isDistanceBased ? distanceKm : null
    ),
    [manifest, outOfTown, rush, rateCard, isDistanceBased, distanceKm]
  )

  // Get matched tier for display
  const matchedTier = useMemo(() => {
    if (!isDistanceBased || !rateCard?.radiusTiers) return null
    return findMatchingTier(distanceKm, rateCard.radiusTiers)
  }, [isDistanceBased, distanceKm, rateCard?.radiusTiers])

  const addItem = (kind: 'small_package' | 'big_package') => {
    setItems(prev => [...prev, { id: `${Date.now()}-${prev.length}`, kind, qty: 1 }])
  }

  const incQty = (id: string) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, qty: it.qty + 1 } : it)))
  }

  const decQty = (id: string) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, qty: Math.max(1, it.qty - 1) } : it)))
  }

  const removeItem = (id: string) => {
    setItems(prev => (prev.length <= 1 ? prev : prev.filter(it => it.id !== id)))
  }

  const reset = () => {
    setItems([{ id: '1', kind: 'small_package', qty: 1 }])
    setOutOfTown(false)
    setRush(false)
    setDistanceKm(5)
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Info className="w-4 h-4" />
          Cost Calculator
          {isDistanceBased && (
            <Badge variant="outline" className="text-xs font-normal gap-1 ml-1">
              <Ruler className="w-3 h-3" />
              Distance-Based
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          See exactly how this delivery will be billed
          {rateCardLabel ? <span className="text-foreground"> &middot; {rateCardLabel}</span> : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Package list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-sm">Packages</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addItem('small_package')} className="h-8">
                <Plus className="w-3.5 h-3.5 mr-1" /> Small
              </Button>
              <Button size="sm" variant="outline" onClick={() => addItem('big_package')} className="h-8">
                <Plus className="w-3.5 h-3.5 mr-1" /> Big
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-2 space-y-1.5">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] p-2"
              >
                {item.kind === 'big_package'
                  ? <Box className="w-4 h-4 text-orange-400" aria-hidden />
                  : <Package className="w-4 h-4 text-blue-400" aria-hidden />}
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                  {item.kind === 'big_package' ? 'Big' : 'Small'} package
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => decQty(item.id)}
                    disabled={item.qty <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-sm font-semibold text-foreground min-w-[1.5rem] text-center tabular-nums">
                    ×{item.qty}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => incQty(item.id)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length <= 1}
                    aria-label="Remove package"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distance input for distance-based pricing */}
        {isDistanceBased && (
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              Delivery Distance
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">km</span>
              {matchedTier && (
                <Badge variant="outline" className="text-xs">
                  {matchedTier.label || `Up to ${matchedTier.maxDistanceKm}km`}
                </Badge>
              )}
            </div>
            {rateCard?.radiusTiers && rateCard.radiusTiers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[...rateCard.radiusTiers]
                  .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm)
                  .map((tier, idx) => (
                    <Button
                      key={tier.id || idx}
                      variant={matchedTier?.maxDistanceKm === tier.maxDistanceKm ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDistanceKm(tier.maxDistanceKm - 0.1)}
                    >
                      {tier.label || `Zone ${idx + 1}`} ({tier.maxDistanceKm}km)
                    </Button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Toggles - hide Out of Town when using distance pricing */}
        <div className={cn("grid gap-2", isDistanceBased ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {!isDistanceBased && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden />
                Out of Town delivery
              </span>
              <Switch checked={outOfTown} onCheckedChange={setOutOfTown} />
            </label>
          )}
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Zap className="w-4 h-4 text-muted-foreground" aria-hidden />
              Rush delivery
            </span>
            <Switch checked={rush} onCheckedChange={setRush} />
          </label>
        </div>

        {/* Breakdown */}
        <BillingBreakdownCard
          rule={breakdown.rule}
          bigPackageCount={breakdown.bigPackageCount}
          outOfTown={isDistanceBased ? false : outOfTown}
          rush={rush}
          rate={breakdown.rate}
          gst={breakdown.gst}
          total={breakdown.total}
          gstApplicable={breakdown.gstApplicable}
          hasRateCard={Boolean(rateCard)}
          distanceKm={isDistanceBased ? distanceKm : null}
          zoneTier={matchedTier}
        />

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset} className="h-8">
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Presentational breakdown card. Also exported for reuse (e.g. post-delivery form).
 */
export function BillingBreakdownCard({
  rule,
  bigPackageCount,
  outOfTown,
  rush,
  rate,
  gst,
  total,
  gstApplicable,
  hasRateCard,
  distanceKm,
  zoneTier,
}: {
  rule: BillingRuleName
  bigPackageCount: number
  outOfTown: boolean
  rush: boolean
  rate: number
  gst: number
  total: number
  gstApplicable: boolean
  hasRateCard: boolean
  distanceKm?: number | null
  zoneTier?: { label?: string | null; maxDistanceKm: number } | null
}) {
  const isZoneBased = distanceKm != null && zoneTier != null

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-2)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Billing breakdown
        </p>
        <RuleBadge rule={rule} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Big packages</dt>
        <dd className="text-foreground text-right tabular-nums">{bigPackageCount}</dd>
        {isZoneBased ? (
          <>
            <dt className="text-muted-foreground">Distance</dt>
            <dd className="text-foreground text-right tabular-nums">{distanceKm.toFixed(1)} km</dd>
            <dt className="text-muted-foreground">Zone</dt>
            <dd className="text-foreground text-right">{zoneTier.label || `Up to ${zoneTier.maxDistanceKm}km`}</dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Out of town</dt>
            <dd className="text-foreground text-right">{outOfTown ? 'Yes' : 'No'}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Rush</dt>
        <dd className="text-foreground text-right">{rush ? 'Yes' : 'No'}</dd>
      </dl>

      <div className="border-t border-[var(--border-color)] pt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rate applied</span>
          <span className="text-foreground tabular-nums">{formatMoney(rate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">GST (5%){!gstApplicable ? ' — not applicable' : ''}</span>
          <span className="text-foreground tabular-nums">{formatMoney(gst)}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border-color)]">
          <span className="text-foreground font-medium">Total</span>
          <span className="text-foreground font-semibold tabular-nums text-base">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      {!hasRateCard && (
        <p className="text-xs text-yellow-400">
          No rate card selected &mdash; values shown are $0.00.
        </p>
      )}
    </div>
  )
}

export function RuleBadge({ rule }: { rule: BillingRuleName }) {
  const color = getRuleBadgeColor(rule)
  const classes: Record<typeof color, string> = {
    red: 'border-red-500/40 bg-red-500/15 text-red-300',
    orange: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
    purple: 'border-purple-500/40 bg-purple-500/15 text-purple-300',
    blue: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
    green: 'border-green-500/40 bg-green-500/15 text-green-300',
    gray: 'border-[var(--border-color)] bg-[var(--bg-card)] text-muted-foreground',
  }
  return (
    <Badge variant="outline" className={cn('font-medium', classes[color])}>
      {rule}
    </Badge>
  )
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`
}
