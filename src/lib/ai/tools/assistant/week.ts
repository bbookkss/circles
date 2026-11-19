import 'server-only'
import {
  todayISO,
  daysBetweenISO,
  relativeDayLabel,
  dayNameISO,
  formatTime,
  checkInWindow,
  meetPhase,
  zonedInstant,
  APP_TZ,
} from '@/lib/schedule'
import type { CirclePlace } from '@/lib/approxLocation'
import type { Meet, Status, Supa } from './types'
import { meetKey } from './types'

/**
 * The person's upcoming meets, the same way the home page works them out:
 * one next occurrence per circle from circles_next_occurrence(), check-in
 * windows evaluated in each circle's own timezone, finished meets dropped.
 * Plus any answer they've scheduled for a meet whose check-in isn't open.
 *
 * Reads only through the person's own client. The venue and exact point come
 * from circle_places(), which returns them because these are their circles.
 */
export async function loadWeek(supabase: Supa, userId: string, viewerTz: string, days = 14): Promise<Meet[]> {
  const today = todayISO(viewerTz)

  const { data: memberships } = await supabase.from('circle_members').select('circle_id').eq('user_id', userId)
  const circleIds = (memberships ?? []).map((m) => m.circle_id as string)
  if (circleIds.length === 0) return []

  const [circlesRes, schedulesRes, nextRes, placesRes, scheduledRes] = await Promise.all([
    supabase.from('circles').select('id, name, emoji, timezone').in('id', circleIds),
    supabase.from('circle_schedules').select('circle_id, start_time, end_time').in('circle_id', circleIds),
    supabase.rpc('circles_next_occurrence', { cids: circleIds }),
    supabase.rpc('circle_places', { cids: circleIds }),
    // From ai-2026-11-18.sql. Until that is applied the table is missing;
    // treat that as "nothing scheduled" rather than failing the whole week.
    supabase
      .from('scheduled_check_ins')
      .select('circle_id, occurs_on, status')
      .eq('user_id', userId)
      .is('applied_at', null)
      .is('failed', null),
  ])

  const circleOf = new Map((circlesRes.data ?? []).map((c) => [c.id as string, c]))
  const scheduleOf = new Map((schedulesRes.data ?? []).map((s) => [s.circle_id as string, s]))
  const placeOf = new Map(((placesRes.data ?? []) as CirclePlace[]).map((p) => [p.circle_id, p]))
  const scheduledOf = new Map(
    (scheduledRes.error ? [] : scheduledRes.data ?? []).map((s) => [meetKey(s.circle_id, s.occurs_on), s.status as Status])
  )

  const next = ((nextRes.data ?? []) as { circle_id: string; occurs_on: string }[])
    .map((n) => ({ n, circle: circleOf.get(n.circle_id), schedule: scheduleOf.get(n.circle_id) }))
    .filter((x) => x.circle && x.schedule)
    .filter((x) => {
      const away = daysBetweenISO(today, x.n.occurs_on)
      return away >= 0 && away <= days
    })
    .filter((x) => {
      const tz = (x.circle!.timezone as string | null) || APP_TZ
      return meetPhase(x.n.occurs_on, x.schedule!.start_time, x.schedule!.end_time, tz) !== 'finished'
    })
    .sort((a, b) => a.n.occurs_on.localeCompare(b.n.occurs_on))

  if (next.length === 0) return []

  const { data: checkIns } = await supabase
    .from('circle_check_ins')
    .select('circle_id, user_id, occurs_on, status')
    .in('circle_id', next.map((x) => x.n.circle_id))
    .in('occurs_on', [...new Set(next.map((x) => x.n.occurs_on))])

  const otherIds = [...new Set((checkIns ?? []).map((c) => c.user_id as string).filter((id) => id !== userId))]
  const { data: people } = otherIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', otherIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const firstName = new Map(
    (people ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? 'Someone').split(' ')[0] || 'Someone'])
  )

  return next.map(({ n, circle, schedule }) => {
    const tz = (circle!.timezone as string | null) || APP_TZ
    const rows = (checkIns ?? []).filter((c) => c.circle_id === n.circle_id && c.occurs_on === n.occurs_on)
    const mine = rows.find((r) => r.user_id === userId)?.status as Status | undefined
    const { open } = checkInWindow(n.occurs_on, schedule!.start_time, schedule!.end_time, tz)
    const rel = relativeDayLabel(n.occurs_on, todayISO(tz))
    const place = placeOf.get(n.circle_id)
    let opensLabel: string | null = null
    if (!open) {
      const opensAt = new Date(zonedInstant(n.occurs_on, schedule!.start_time, tz).getTime() - 24 * 3600 * 1000)
      opensLabel = opensAt.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: tz })
    }
    return {
      circle_id: n.circle_id,
      occurs_on: n.occurs_on,
      circle_name: circle!.name as string,
      emoji: (circle!.emoji as string | null) ?? null,
      day_label: rel === 'Today' || rel === 'Tomorrow' ? rel : dayNameISO(n.occurs_on),
      time_label: `${formatTime(schedule!.start_time)} – ${formatTime(schedule!.end_time)}`,
      timezone: tz,
      open,
      opens_label: opensLabel,
      my_status: mine ?? null,
      scheduled_status: scheduledOf.get(meetKey(n.circle_id, n.occurs_on)) ?? null,
      going: rows.filter((r) => r.status === 'yes' && r.user_id !== userId).map((r) => firstName.get(r.user_id) ?? 'Someone'),
      maybe_count: rows.filter((r) => r.status === 'maybe' && r.user_id !== userId).length,
      venue: place?.location ?? null,
      thumb: place?.latitude != null && place?.longitude != null ? { lat: place.latitude, lng: place.longitude, exact: true } : null,
    }
  })
}

/** What the model sees for a meet: compact, and only server-produced IDs. */
export function meetForModel(m: Meet) {
  return {
    circle_id: m.circle_id,
    occurs_on: m.occurs_on,
    circle: m.circle_name,
    when: `${m.day_label}, ${m.time_label}`,
    check_in: m.open ? 'open' : `opens ${m.opens_label}`,
    my_answer: m.my_status ?? (m.scheduled_status ? `scheduled: ${m.scheduled_status}` : 'none'),
    going: m.going,
    maybe: m.maybe_count,
  }
}
