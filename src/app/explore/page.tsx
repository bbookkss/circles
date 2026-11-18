import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ExploreClient from './ExploreClient'
import { geoFromHeaders, resolveMapView } from '@/lib/mapView'
import type { CirclePlace } from '@/lib/approxLocation'

export default async function ExplorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Wave 1 — nothing here needs anything from the others.
  const [{ data: circles }, { data: people }, { data: myMemberships }, { data: myBlocks }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, description, category, emoji, neighborhood, city, area_latitude, area_longitude, kind')
      .not('area_latitude', 'is', null)
      .not('area_longitude', 'is', null),
    supabase
      .from('profiles')
      .select('id, full_name, instagram')
      .neq('id', user.id),
    // The circles this user is already in are the best guess at where they are.
    supabase.from('circle_members').select('circle_id').eq('user_id', user.id),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
  ])

  const blocked = new Set((myBlocks ?? []).map((b) => b.blocked_id))
  const peopleList = (people ?? []).filter((p) => p.full_name && !blocked.has(p.id))
  const myCircleIds = (myMemberships ?? []).map((m) => m.circle_id)
  const circleIds = (circles ?? []).map((c) => c.id)

  // Wave 2 — member counts and schedules for the pins, plus the exact place of
  // this user's own circles, which only circle_places() will hand over.
  //
  // Counts come from one grouped RPC. This used to be a query per circle: fine
  // at seven, ruinous at two hundred, and an explore page exists to have more
  // than seven. The function is invoker-rights, so the numbers stay
  // RLS-filtered exactly as the per-circle counts were.
  const [countsResult, schedulesResult, myCirclesResult] = await Promise.all([
    circleIds.length > 0
      ? supabase.rpc('circle_member_counts', { cids: circleIds })
      : Promise.resolve({ data: [] as { circle_id: string; member_count: number }[] }),
    circleIds.length > 0
      ? supabase.from('circle_schedules').select('circle_id, days_of_week').in('circle_id', circleIds)
      : Promise.resolve({ data: [] as { circle_id: string; days_of_week: number[] }[] }),
    myCircleIds.length > 0
      ? supabase.rpc('circle_places', { cids: myCircleIds })
      : Promise.resolve({ data: [] as CirclePlace[] }),
  ])
  const myPlaces = ((myCirclesResult.data ?? []) as CirclePlace[])
    .filter((p) => p.latitude != null && p.longitude != null)
  const placeOf = new Map(myPlaces.map((p) => [p.circle_id, p]))

  // Decision and header parsing both live in lib/mapView so they can be
  // tested without a request; this only supplies the inputs.
  const h = await headers()
  const geo = geoFromHeaders((name) => h.get(name))
  const { view: initialView } = resolveMapView(myPlaces, geo)
  // City-level, from the IP, and good enough to sort a list by and say
  // "about 3 mi". The browser's own fix replaces it client-side when the
  // person has already granted location, or taps the locate button.
  const origin = geo ? { latitude: geo.latitude, longitude: geo.longitude } : null

  if (!circles) return (
    <>
      <TopNav />
      <ExploreClient circles={[]} people={peopleList} initialView={initialView} origin={origin} />
    </>
  )

  const countMap = Object.fromEntries(
    ((countsResult.data ?? []) as { circle_id: string; member_count: number }[])
      .map((r) => [r.circle_id, Number(r.member_count)])
  )
  const scheduleMap: Record<string, number[]> = {}
  for (const s of schedulesResult.data ?? []) {
    scheduleMap[s.circle_id] = s.days_of_week
  }

  // Only circles you belong to are plotted where they actually meet. The rest
  // go on their area, the displaced centre the database stores; the real
  // coordinates of a circle you are not in are never read at all.
  const enriched = circles.map(({ area_latitude, area_longitude, ...c }) => {
    const exact = placeOf.get(c.id)
    return {
      ...c,
      latitude: exact ? exact.latitude! : area_latitude,
      longitude: exact ? exact.longitude! : area_longitude,
      location: exact?.location ?? null,
      approximate: !exact,
      member_count: countMap[c.id] ?? 0,
      days_of_week: scheduleMap[c.id] ?? [],
    }
  })

  return (
    <>
      <TopNav />
      <ExploreClient circles={enriched} people={peopleList} initialView={initialView} origin={origin} />
    </>
  )
}
