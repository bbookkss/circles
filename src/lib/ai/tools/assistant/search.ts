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
const wordsOf = (text: string, min = 2, max = 8) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= min && !STOP.has(w))
    .slice(0, max)

export type PlaceHit = { label: string; latitude: number; longitude: number; zoom: number; from: 'map' | 'circles' }

/**
 * A place name to coordinates. The map geocoder first (cities and
 * neighbourhoods only). If it doesn't know the name, which happens with
 * newer neighbourhood names like East Cut, fall back to the circles
 * themselves: the middle of the areas of circles whose neighbourhood or name
 * contains it. Those are shown areas, already displaced, so this reveals
 * nothing a non-member can't see on the map.
 */
export async function findPlace(ctx: Ctx, name: string): Promise<PlaceHit | null> {
  const p = await forwardGeocode(name)
  if (p) return { label: p.label, latitude: p.latitude, longitude: p.longitude, zoom: p.zoom, from: 'map' }
  const words = wordsOf(name, 3, 4)
  if (!words.length) return null
  const { data } = await ctx.supabase
    .from('circles')
    .select('name, neighborhood, city, area_latitude, area_longitude')
    .not('area_latitude', 'is', null)
    .limit(500)
  const hits = (data ?? []).filter((c) => {
    const hay = `${c.name} ${c.neighborhood ?? ''} ${c.city ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  if (!hits.length) return null
  const lat = hits.reduce((a, c) => a + (c.area_latitude as number), 0) / hits.length
  const lng = hits.reduce((a, c) => a + (c.area_longitude as number), 0) / hits.length
  const label = (hits.find((c) => c.neighborhood && words.every((w) => String(c.neighborhood).toLowerCase().includes(w)))?.neighborhood as string | undefined) ?? name
  return { label: String(label).slice(0, 80), latitude: lat, longitude: lng, zoom: 14, from: 'circles' }
}

/**
 * Circles by activity, near the person, or within radiusKm of a point that
 * find_place produced. With no activity, everything nearby.
 */
export async function searchCircles(
  ctx: Ctx,
  input: { query: string; near?: { latitude: number; longitude: number; label?: string | null } | null; radiusKm?: number | null }
): Promise<ToolOutput> {
  const { supabase, userId } = ctx
  const words = wordsOf(String(input.query ?? ''))
  const center = input.near ?? ctx.near
  const placeLabel = input.near ? (input.near.label ?? 'that spot') : null
  const radius = input.radiusKm ?? (input.near ? 3 : 60)

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
      const score = words.length ? words.filter((w) => hay.includes(w)).length : 1
      const km = center
        ? distanceKm(center, { latitude: c.area_latitude as number, longitude: c.area_longitude as number })
        : null
      return { c, score, km }
    })
    .filter((x) => x.score > 0)
    // Within the radius asked for (default: a few km of a place, a metro of the person).
    .filter((x) => x.km === null || x.km <= radius)
    .sort((a, b) => b.score - a.score || (a.km ?? 0) - (b.km ?? 0))
    .slice(0, input.near ? 8 : 5)

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
