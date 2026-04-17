'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, RotateCw } from 'lucide-react'
import { calculateRate, getRuleApplied, type BillingRuleName } from '@/lib/billing'
import type { ManifestItem, RateCard } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RuleBadge } from '@/components/shared/CostCalculator'

interface BillingScenarioTestsProps {
  rateCard: RateCard | null
  rateCardLabel?: string
}

type ScenarioPackages = { small?: number; big?: number }

interface Scenario {
  id: number
  label: string
  packages: ScenarioPackages
  oot: boolean
  rush: boolean
  expectedRule: BillingRuleName
  /** Returns the expected rate for the given rateCard. */
  expectedRate: (r: RateCard) => number
}

const SCENARIOS: Scenario[] = [
  { id: 1,  label: '1 small package, in town, no rush',            packages: { small: 1 },          oot: false, rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 2,  label: '1 big package, in town, no rush',              packages: { big: 1 },            oot: false, rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 3,  label: '2 big packages, in town, no rush',             packages: { big: 2 },            oot: false, rush: false, expectedRule: '2+ Big Packages — In Town',     expectedRate: r => r.rateBigDouble },
  { id: 4,  label: '5 big packages, in town, no rush (flat)',      packages: { big: 5 },            oot: false, rush: false, expectedRule: '2+ Big Packages — In Town',     expectedRate: r => r.rateBigDouble },
  { id: 5,  label: '1 big + 1 small, in town, no rush',            packages: { big: 1, small: 1 },  oot: false, rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 6,  label: '1 small package, out of town, no rush',        packages: { small: 1 },          oot: true,  rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 7,  label: '1 big package, out of town, no rush',          packages: { big: 1 },            oot: true,  rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 8,  label: '2 big packages, out of town, no rush',         packages: { big: 2 },            oot: true,  rush: false, expectedRule: '2+ Big Packages — Out of Town', expectedRate: r => r.rateOotBig ?? r.rateBigDouble },
  { id: 9,  label: '5 big packages, out of town, no rush (flat)',  packages: { big: 5 },            oot: true,  rush: false, expectedRule: '2+ Big Packages — Out of Town', expectedRate: r => r.rateOotBig ?? r.rateBigDouble },
  { id: 10, label: '1 small package, in town, RUSH',               packages: { small: 1 },          oot: false, rush: true,  expectedRule: 'Rush',                          expectedRate: r => r.rateRush },
  { id: 11, label: '2 big packages, in town, RUSH',                packages: { big: 2 },            oot: false, rush: true,  expectedRule: 'Rush',                          expectedRate: r => r.rateRush },
  { id: 12, label: '5 big packages, in town, RUSH',                packages: { big: 5 },            oot: false, rush: true,  expectedRule: 'Rush',                          expectedRate: r => r.rateRush },
  { id: 13, label: '1 small package, out of town, RUSH',           packages: { small: 1 },          oot: true,  rush: true,  expectedRule: 'Rush + Out of Town',            expectedRate: r => r.rateRushOot },
  { id: 14, label: '1 big package, out of town, RUSH',             packages: { big: 1 },            oot: true,  rush: true,  expectedRule: 'Rush + Out of Town',            expectedRate: r => r.rateRushOot },
  { id: 15, label: '2 big packages, out of town, RUSH',            packages: { big: 2 },            oot: true,  rush: true,  expectedRule: 'Rush + Out of Town',            expectedRate: r => r.rateRushOot },
  { id: 16, label: '10 big packages, out of town, RUSH',           packages: { big: 10 },           oot: true,  rush: true,  expectedRule: 'Rush + Out of Town',            expectedRate: r => r.rateRushOot },
  { id: 17, label: '1 big + 1 small, out of town, no rush',        packages: { big: 1, small: 1 },  oot: true,  rush: false, expectedRule: 'Regular',                       expectedRate: r => r.rateRegular },
  { id: 18, label: '2 big + 3 small, in town, no rush',            packages: { big: 2, small: 3 },  oot: false, rush: false, expectedRule: '2+ Big Packages — In Town',     expectedRate: r => r.rateBigDouble },
  { id: 19, label: '2 big + 3 small, out of town, no rush',        packages: { big: 2, small: 3 },  oot: true,  rush: false, expectedRule: '2+ Big Packages — Out of Town', expectedRate: r => r.rateOotBig ?? r.rateBigDouble },
  { id: 20, label: '2 big + 3 small, out of town, RUSH',           packages: { big: 2, small: 3 },  oot: true,  rush: true,  expectedRule: 'Rush + Out of Town',            expectedRate: r => r.rateRushOot },
]

function buildManifest(packages: ScenarioPackages): ManifestItem[] {
  const items: ManifestItem[] = []
  if (packages.small && packages.small > 0) {
    items.push({
      id: `s-${packages.small}`,
      type: 'small_package',
      postedQty: packages.small,
      confirmedQty: null,
      verificationPhotoUrl: null,
      notes: '',
    })
  }
  if (packages.big && packages.big > 0) {
    items.push({
      id: `b-${packages.big}`,
      type: 'big_package',
      postedQty: packages.big,
      confirmedQty: null,
      verificationPhotoUrl: null,
      notes: '',
    })
  }
  return items
}

interface ScenarioResult {
  scenario: Scenario
  actualRule: BillingRuleName
  actualRate: number
  expectedRate: number
  passed: boolean
}

function runAllScenarios(rateCard: RateCard): ScenarioResult[] {
  return SCENARIOS.map(scenario => {
    const manifest = buildManifest(scenario.packages)
    const actualRule = getRuleApplied(manifest, scenario.oot, scenario.rush, false)
    const actualRate = calculateRate(manifest, scenario.oot, scenario.rush, rateCard, false)
    const expectedRate = scenario.expectedRate(rateCard)
    const passed = actualRule === scenario.expectedRule && actualRate === expectedRate
    return { scenario, actualRule, actualRate, expectedRate, passed }
  })
}

export function BillingScenarioTests({ rateCard, rateCardLabel }: BillingScenarioTestsProps) {
  const [runKey, setRunKey] = useState(0)

  const results = useMemo<ScenarioResult[]>(() => {
    if (!rateCard) return []
    return runAllScenarios(rateCard)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCard, runKey])

  const passCount = results.filter(r => r.passed).length
  const totalCount = results.length
  const allPassed = totalCount > 0 && passCount === totalCount
  const hasFailures = totalCount > 0 && passCount < totalCount

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base text-foreground">Billing Scenario Tests</CardTitle>
            <CardDescription>
              Verify all scenarios calculate correctly
              {rateCardLabel ? <span className="text-foreground"> &middot; {rateCardLabel}</span> : null}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRunKey(k => k + 1)}
            disabled={!rateCard}
            className="h-8"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Run Tests
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!rateCard && (
          <p className="text-sm text-muted-foreground">
            Select a store to run scenario tests against its rate card.
          </p>
        )}

        {rateCard && (
          <>
            <ResultBanner allPassed={allPassed} hasFailures={hasFailures} passCount={passCount} total={totalCount} />

            <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-card-2)]">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium w-10">#</th>
                      <th className="px-3 py-2 font-medium">Scenario</th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">Expected</th>
                      <th className="px-3 py-2 font-medium text-right">Rate</th>
                      <th className="px-3 py-2 font-medium text-right w-24">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(result => (
                      <tr
                        key={result.scenario.id}
                        className={cn(
                          'border-t border-[var(--border-color)]',
                          result.passed
                            ? 'bg-transparent'
                            : 'bg-red-500/5'
                        )}
                      >
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{result.scenario.id}</td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="font-medium">{result.scenario.label}</div>
                          <div className="md:hidden mt-1">
                            <RuleBadge rule={result.scenario.expectedRule} />
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <RuleBadge rule={result.scenario.expectedRule} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="tabular-nums text-foreground">${result.expectedRate.toFixed(2)}</div>
                          {!result.passed && (
                            <div className="tabular-nums text-red-400 text-xs mt-0.5">
                              got ${result.actualRate.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {result.passed ? (
                            <Badge variant="outline" className="border-green-500/40 bg-green-500/15 text-green-300 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/40 bg-red-500/15 text-red-300 gap-1">
                              <XCircle className="w-3 h-3" /> Fail
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ResultBanner({
  allPassed,
  hasFailures,
  passCount,
  total,
}: {
  allPassed: boolean
  hasFailures: boolean
  passCount: number
  total: number
}) {
  if (allPassed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-green-300 text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>All {total} billing scenarios verified correct</span>
      </div>
    )
  }
  if (hasFailures) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-300 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Billing calculation has errors &mdash; {passCount}/{total} passing. Check <code className="font-mono text-xs bg-[var(--bg-card-2)] px-1 py-0.5 rounded">lib/billing.ts</code>.
        </span>
      </div>
    )
  }
  return null
}
