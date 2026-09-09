/**
 * Display helpers for schedules.
 *
 * The recurrence maths deliberately does NOT live here — it is in SQL
 * (`schedule_occurs_on`, `circle_next_occurrence`, `circles_next_occurrence`)
 * because check-ins need the database to validate a date it was handed, and
 * two implementations of a recurrence rule drift. This file only turns a date
 * the database already produced into something to read.
 */

// Fallback only. Circles carry their own `timezone`, resolved from their
// coordinates, and anything time-sensitive should pass that in — they are not
// all Pacific any more.
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


/** UTC offset of `tz` at a given instant, in milliseconds. */
function tzOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(at)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asUTC - at.getTime()
}

/**
 * The instant at which a wall-clock date and time in `tz` actually happens.
 *
 * Two passes: the offset is itself a function of the instant, so the first
 * guess is corrected once. That resolves every case except the ambiguous hour
 * of a DST fall-back, where either answer is defensible.
 */
export function zonedInstant(dateISO: string, time: string, tz: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [hh, mm, ss] = time.split(':').map(Number)
  const naiveUTC = Date.UTC(y, m - 1, d, hh, mm, ss || 0)
  const guess = naiveUTC - tzOffsetMs(new Date(naiveUTC), tz)
  return new Date(naiveUTC - tzOffsetMs(new Date(guess), tz))
}

/**
 * Mirrors the `circle_check_ins` trigger: check-in opens 24 hours before the
 * meet starts and closes when it ends, evaluated in the circle's own timezone.
 *
 * The trigger is the real gate — this exists so the UI does not offer a button
 * the database is certain to reject. Counting calendar days is not good
 * enough: a meet "tomorrow" at 5:30pm is 31 hours away this morning, which
 * reads as open and is not.
 */
export function checkInWindow(
  occursOn: string,
  startTime: string,
  endTime: string,
  tz: string = APP_TZ,
  now: Date = new Date()
): { open: boolean; reason?: string } {
  const start = zonedInstant(occursOn, startTime, tz)
  const end = zonedInstant(occursOn, endTime, tz)

  if (now.getTime() < start.getTime() - 24 * 60 * 60 * 1000) {
    return { open: false, reason: 'Check-in opens 24 hours before the meet.' }
  }
  if (now.getTime() > end.getTime()) {
    return { open: false, reason: 'That meet has already finished.' }
  }
  return { open: true }
}
