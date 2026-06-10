import { createClient } from "@/lib/supabase/client"

export const ORG_ID = "00000000-0000-0000-0000-000000000001"

export interface BusinessCutoff {
  id: string
  businessId: string
  dayOfWeek: number | null // null = default for all days; 0=Sun..6=Sat override
  cutoffTime: string // "HH:MM" or "HH:MM:SS"
  timezone: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

interface CutoffRow {
  id: string
  business_id: string
  day_of_week: number | null
  cutoff_time: string
  timezone: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

function mapCutoff(r: CutoffRow): BusinessCutoff {
  return {
    id: r.id,
    businessId: r.business_id,
    dayOfWeek: r.day_of_week,
    cutoffTime: r.cutoff_time,
    timezone: r.timezone,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** All cutoff rows for a business (default + any day-of-week overrides). */
export async function getBusinessCutoffs(businessId: string): Promise<BusinessCutoff[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("business_cutoffs")
    .select("*")
    .eq("business_id", businessId)
    .order("day_of_week", { ascending: true, nullsFirst: true })
  if (error) throw error
  return (data as CutoffRow[]).map(mapCutoff)
}

/** Cutoffs for every business, keyed by businessId. */
export async function getAllBusinessCutoffs(): Promise<Record<string, BusinessCutoff[]>> {
  const supabase = createClient()
  const { data, error } = await supabase.from("business_cutoffs").select("*")
  if (error) throw error
  const out: Record<string, BusinessCutoff[]> = {}
  for (const row of data as CutoffRow[]) {
    const c = mapCutoff(row)
    ;(out[c.businessId] ||= []).push(c)
  }
  return out
}

/**
 * Upsert the default cutoff (day_of_week = null) for a business.
 * Passing an empty/undefined time removes the default cutoff.
 */
export async function setDefaultCutoff(
  businessId: string,
  cutoffTime: string | null,
  timezone = "America/Edmonton",
): Promise<void> {
  const supabase = createClient()
  if (!cutoffTime) {
    const { error } = await supabase
      .from("business_cutoffs")
      .delete()
      .eq("business_id", businessId)
      .is("day_of_week", null)
    if (error) throw error
    return
  }
  // manual upsert because the uniqueness is enforced by a partial index
  const { data: existing } = await supabase
    .from("business_cutoffs")
    .select("id")
    .eq("business_id", businessId)
    .is("day_of_week", null)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from("business_cutoffs")
      .update({ cutoff_time: cutoffTime, timezone, is_active: true })
      .eq("id", (existing as { id: string }).id)
    if (error) throw error
  } else {
    const { error } = await supabase.from("business_cutoffs").insert({
      org_id: ORG_ID,
      business_id: businessId,
      day_of_week: null,
      cutoff_time: cutoffTime,
      timezone,
    })
    if (error) throw error
  }
}

/** Upsert a per-weekday override (0=Sun..6=Sat). Null time removes the override. */
export async function setDayOverride(
  businessId: string,
  dayOfWeek: number,
  cutoffTime: string | null,
  timezone = "America/Edmonton",
): Promise<void> {
  const supabase = createClient()
  if (!cutoffTime) {
    const { error } = await supabase
      .from("business_cutoffs")
      .delete()
      .eq("business_id", businessId)
      .eq("day_of_week", dayOfWeek)
    if (error) throw error
    return
  }
  const { data: existing } = await supabase
    .from("business_cutoffs")
    .select("id")
    .eq("business_id", businessId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from("business_cutoffs")
      .update({ cutoff_time: cutoffTime, timezone, is_active: true })
      .eq("id", (existing as { id: string }).id)
    if (error) throw error
  } else {
    const { error } = await supabase.from("business_cutoffs").insert({
      org_id: ORG_ID,
      business_id: businessId,
      day_of_week: dayOfWeek,
      cutoff_time: cutoffTime,
      timezone,
    })
    if (error) throw error
  }
}

export interface CutoffEvaluation {
  hasCutoff: boolean
  isPastCutoff: boolean
  cutoffTime: string | null
  timezone: string | null
  /** Local "HH:MM" now-time used for the comparison, for display. */
  nowLocal: string | null
}

/**
 * Get the effective cutoff for a business at a given moment, resolving the
 * day-of-week override first and falling back to the default row.
 */
export function resolveEffectiveCutoff(
  cutoffs: BusinessCutoff[],
  at: Date = new Date(),
): BusinessCutoff | null {
  const active = cutoffs.filter((c) => c.isActive)
  if (active.length === 0) return null
  // Determine the weekday in the cutoff's own timezone using the default row's tz
  const tz = active[0].timezone || "America/Edmonton"
  const dow = getWeekdayInTz(at, tz)
  const override = active.find((c) => c.dayOfWeek === dow)
  if (override) return override
  return active.find((c) => c.dayOfWeek === null) ?? null
}

/** Weekday (0=Sun..6=Sat) of `date` in the given IANA timezone. */
function getWeekdayInTz(date: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[wd] ?? date.getDay()
}

/** "HH:MM" current local time in the given IANA timezone. */
function getLocalHHMM(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

/** Compare two "HH:MM[:SS]" strings; returns true when a >= b. */
function timeGte(a: string, b: string): boolean {
  const norm = (t: string) => t.split(":").slice(0, 2).join(":")
  return norm(a) >= norm(b)
}

/**
 * Evaluate whether `at` is past the business's cutoff. Timezone-aware.
 * If the business has no cutoff configured, hasCutoff=false (never blocks).
 */
export function evaluateCutoff(
  cutoffs: BusinessCutoff[],
  at: Date = new Date(),
): CutoffEvaluation {
  const eff = resolveEffectiveCutoff(cutoffs, at)
  if (!eff) {
    return { hasCutoff: false, isPastCutoff: false, cutoffTime: null, timezone: null, nowLocal: null }
  }
  const tz = eff.timezone || "America/Edmonton"
  const nowLocal = getLocalHHMM(at, tz)
  return {
    hasCutoff: true,
    isPastCutoff: timeGte(nowLocal, eff.cutoffTime),
    cutoffTime: eff.cutoffTime.split(":").slice(0, 2).join(":"),
    timezone: tz,
    nowLocal,
  }
}

/** Convenience: fetch + evaluate in one call for a single business. */
export async function checkBusinessCutoff(
  businessId: string,
  at: Date = new Date(),
): Promise<CutoffEvaluation> {
  const cutoffs = await getBusinessCutoffs(businessId)
  return evaluateCutoff(cutoffs, at)
}
