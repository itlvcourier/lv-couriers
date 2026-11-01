export type RecurringFrequency = 'daily' | 'weekdays' | 'weekly'

export interface RecurringTemplate {
  dropoffAddress: string
  dropoffArea: string
  dropoffPostalCode?: string | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  recipientName?: string | null
  recipientPhone?: string | null
  recipientNote?: string | null
  isRush?: boolean
  requireSignature?: boolean
  requirePin?: boolean
}

/** Offset in minutes between UTC and the given zone at `date` (e.g. -240 for EDT). */
function zoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - date.getTime()) / 60000)
}

function localWeekday(date: Date, timeZone: string) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
}

/** Next run strictly after `after`, at `timeOfDay` (HH:MM) local time in `timeZone`. */
export function computeNextRun(
  frequency: RecurringFrequency,
  daysOfWeek: number[],
  timeOfDay: string,
  timeZone: string,
  after: Date = new Date(),
): Date {
  const [hh, mm] = timeOfDay.split(':').map((n) => Number(n) || 0)
  for (let i = 0; i < 15; i++) {
    const probe = new Date(after.getTime() + i * 86400000)
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(probe)
    const [y, m, d] = ymd.split('-').map(Number)
    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
    const candidate = new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60000)
    if (candidate <= after) continue
    const wd = localWeekday(candidate, timeZone)
    if (frequency === 'weekdays' && (wd === 0 || wd === 6)) continue
    if (frequency === 'weekly' && daysOfWeek.length && !daysOfWeek.includes(wd)) continue
    return candidate
  }
  return new Date(after.getTime() + 86400000)
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function describeSchedule(frequency: RecurringFrequency, days: number[], time: string) {
  if (frequency === 'daily') return `Every day at ${time}`
  if (frequency === 'weekdays') return `Weekdays at ${time}`
  return `${days.length ? days.map((d) => WEEKDAY_SHORT[d]).join(', ') : 'Weekly'} at ${time}`
}
