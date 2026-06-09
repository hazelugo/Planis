const MS_PER_DAY = 86_400_000

/** Parse YYYY-MM-DD as local calendar midnight (avoids UTC off-by-one). */
export function parseLocalDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return new Date(iso + 'T00:00:00')
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function localTodayIso(): string {
  return formatIsoDate(startOfToday())
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add calendar days to a YYYY-MM-DD string; returns YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const d = parseLocalDate(iso)
  if (!d) return iso
  d.setDate(d.getDate() + days)
  return formatIsoDate(d)
}

/** Whole calendar days from today (local) until iso date; 0 = today, negative = past. */
export function daysUntil(iso: string): number | null {
  const target = parseLocalDate(iso)
  if (!target) return null
  return Math.round((target.getTime() - startOfToday().getTime()) / MS_PER_DAY)
}

/** Calendar days between two YYYY-MM-DD dates (end − start). */
export function daysBetween(startIso: string, endIso: string): number {
  const s = parseLocalDate(startIso)
  const e = parseLocalDate(endIso)
  if (!s || !e) return 0
  return Math.round((e.getTime() - s.getTime()) / MS_PER_DAY)
}

/** Trip length in calendar days (start → end); 0 when same day or invalid. */
export function tripDurationDays(startIso: string, endIso: string): number {
  return Math.max(0, daysBetween(startIso, endIso))
}
