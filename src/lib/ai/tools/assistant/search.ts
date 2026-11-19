import 'server-only'
import { distanceKm } from '@/lib/mapView'
import { forwardGeocode } from '@/lib/geocoding'
import type { CirclePlace } from '@/lib/approxLocation'
import type { Card, Ctx, ToolOutput } from './types'

const STOP = new Set(
  'a an the i im me my to for in on at of and or with near some any find looking want group groups club circle circles something things do where can is there people weekly local'.split(' ')
)

/**
 * Circles by activity, near the person or near a named place.
 *
 * Same visibility rules as Explore, because it is the same client: RLS
 * decides which circles come back. Non-member circles carry only their shown
 * area (area_latitude/area_longitude). The exact point comes from
 * circle_places(), which only answers for circles the person belongs to.
 *
 * Matching is plain keyword matching in code over what RLS returned, not a
 * query string built from model input.
 */
export async function searchCircles(ctx: Ctx, input: { query: string; place?: string | null }): Promise<ToolOutput> {
  const { supabase, userId } = ctx
  const words = String(input.query ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 8)

  let center = ctx.near
  let placeLabel: string | null = null
  // A place can be a circle's own name or neighbourhood ("Salesforce Park",
  // "the Mission"). Those words must all appear for a circle to count as being
  // there, which works even when no map lookup is possible.
  const placeWords = String(input.place ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 4)
  let byName = false
  if (input.place) {
    const p = await forwardGeocode(String(input.place))
    if (p) {
      center = { latitude: p.latitude, longitude: p.longitude }
      placeLabel = p.label
    } else {
      byName = placeWords.length > 0
      if (!byName) return { forModel: { error: `Couldn't find a place called "${String(input.place).slice(0, 60)}".` }, cards: [] }
    }
  }

  const [{ data: circles }, { data: mine }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, description, category, emoji, neighborhood, city, area_latitude, area_longitude')
      .not('area_latitude', 'is', null)
      .not('area_longitude', 'is', null)
      .limit(500),
    supabase.from('circle_members').select('circle_id').eq('user_id', userId),
  ])
  const memberOf = new Set((mine ?? []).map((m) => m.circle_id as string))

  const scored = (circles ?? [])
    .map((c) => {
      const hay = `${c.name} ${c.description ?? ''} ${c.category ?? ''} ${c.neighborhood ?? ''} ${c.city ?? ''}`.toLowerCase()
      // Named after the place, or in it: either way, it's "at" that place.
      const atPlace = placeWords.length > 0 && placeWords.every((w) => hay.includes(w))
      if (byName && !atPlace) return { c, score: 0, km: null }
      const score = (words.length ? words.filter((w) => hay.includes(w)).length : 1) + (atPlace ? 2 : 0)
      const km = center
        ? distanceKm(center, { latitude: c.area_latitude as number, longitude: c.area_longitude as number })
        : null
      return { c, score, km }
    })
    .filter((x) => x.score > 0)
    // Within a metro of the place asked about. Without any location, nearest is meaningless.
    .filter((x) => x.km === null || x.km <= (placeLabel ? 40 : 60))
    .sort((a, b) => b.score - a.score || (a.km ?? 0) - (b.km ?? 0))
    .slice(0, input.place ? 8 : 5)

  const ids = scored.map((x) => x.c.id as string)
  const memberIds = ids.filter((id) => memberOf.has(id))
  const [countsRes, schedulesRes, placesRes] = await Promise.all([
    ids.length ? supabase.rpc('circle_member_counts', { cids: ids }) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('circle_schedules').select('circle_id, days_of_week').in('circle_id', ids)
      : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.rpc('circle_places', { cids: memberIds }) : Promise.resolve({ data: [] }),
  ])
  const countOf = new Map(
    ((countsRes.data ?? []) as { circle_id: string; member_count: number }[]).map((r) => [r.circle_id, Number(r.member_count)])
  )
  const daysOf = new Map(
    ((schedulesRes.data ?? []) as { circle_id: string; days_of_week: number[] }[]).map((s) => [s.circle_id, s.days_of_week])
  )
  const placeOf = new Map(((placesRes.data ?? []) as CirclePlace[]).map((p) => [p.circle_id, p]))

  const cards: Card[] = scored.map(({ c }) => {
    const exact = placeOf.get(c.id)
    const isMember = memberOf.has(c.id)
    return {
      kind: 'circle',
      circle_id: c.id,
      name: c.name,
      emoji: c.emoji ?? null,
      neighborhood: c.neighborhood ?? c.city ?? null,
      category: c.category ?? null,
      days: daysOf.get(c.id) ?? [],
      member_count: countOf.get(c.id) ?? 0,
      is_member: isMember,
      thumb:
        isMember && exact?.latitude != null && exact?.longitude != null
          ? { lat: exact.latitude, lng: exact.longitude, exact: true }
          : { lat: c.area_latitude, lng: c.area_longitude, exact: false },
    }
  })

  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    forModel: {
      searched_near: placeLabel ?? (center ? 'the person' : 'anywhere'),
      results: scored.map(({ c, km }) => ({
        circle_id: c.id,
        name: c.name,
        category: c.category,
        neighborhood: c.neighborhood ?? c.city,
        meets: (daysOf.get(c.id) ?? []).map((d) => DAY[d]).join(', '),
        members: countOf.get(c.id) ?? 0,
        you_are_a_member: memberOf.has(c.id),
        km: km === null ? null : Math.round(km * 10) / 10,
      })),
    },
    cards,
  }
}
