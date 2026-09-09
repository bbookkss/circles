/**
 * Display helpers for schedules.
 *
 * The recurrence maths deliberately does NOT live here — it is in SQL
 * (`schedule_occurs_on`, `circle_next_occurrence`, `circles_next_occurrence`)
 * because check-ins need the database to validate a date it was handed, and
 * two implementations of a recurrence rule drift. This file only turns a date
 * the database already produced into something to read.
 */

// Every circle is Pacific today. When one is not, this should come from
// circles.timezone, which already exists and defaults to the same value.
export const APP_TZ = 'America/Los_Angeles'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Today as YYYY-MM-DD, in local time rather than the server's UTC. */
export function todayISO(tz: string = APP_TZ): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

/** Parsed at noon UTC so a timezone offset can never roll it to a neighbouring day. */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()
  return Math.round(ms / 86400000)
}

export function dayNameISO(iso: string): string {
  return DAY_NAMES[parseISODate(iso).getUTCDay()]
}

/** "Today", "Tomorrow", "Sat", or a date once it is far enough out to need one. */
export function relativeDayLabel(iso: string, todayIso: string = todayISO()): string {
  const diff = daysBetweenISO(todayIso, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return DAY_SHORT[parseISODate(iso).getUTCDay()]
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}
