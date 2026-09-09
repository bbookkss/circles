import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ExploreClient from './ExploreClient'
import { SF_VIEW, viewForPoints, type MapView } from '@/lib/mapView'

/**
 * Where to open the map, and what to call that place.
 *
 * The IP headers are populated by Vercel's edge and are absent locally, which
 * is why San Francisco remains the final fallback rather than an error.
 */
async function resolveInitialView(
  myCircles: { latitude: number | null; longitude: number | null }[]
): Promise<{ view: MapView; place: string | null }> {
  const mine = myCircles.filter(
    (c): c is { latitude: number; longitude: number } =>
      c.latitude !== null && c.longitude !== null
  )
  const fromCircles = viewForPoints(mine)
  if (fromCircles) return { view: fromCircles, place: null }

  const h = await headers()
  const lat = Number(h.get('x-vercel-ip-latitude'))
  const lng = Number(h.get('x-vercel-ip-longitude'))
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    const city = h.get('x-vercel-ip-city')
    return {
      view: { latitude: lat, longitude: lng, zoom: 11 },
      // Vercel percent-encodes the city header ("San%20Francisco").
      place: city ? decodeURIComponent(city) : null,
    }
  }

  return { view: SF_VIEW, place: null }
}

export default async function ExplorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: circles }, { data: people }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, description, category, emoji, location, neighborhood, city, latitude, longitude, kind')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    supabase
      .from('profiles')
      .select('id, full_name, instagram')
      .neq('id', user.id),
  ])

  const peopleList = (people ?? []).filter((p) => p.full_name)

  // The circles this user is already in are the best guess at where they are.
  const { data: myMemberships } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', user.id)

  const myCircleIds = (myMemberships ?? []).map((m) => m.circle_id)
  const { data: myCircles } = myCircleIds.length > 0
    ? await supabase
        .from('circles')
        .select('latitude, longitude')
        .in('id', myCircleIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
    : { data: [] as { latitude: number | null; longitude: number | null }[] }

  const { view: initialView, place } = await resolveInitialView(myCircles ?? [])

  if (!circles) return (
    <>
      <TopNav />
      <ExploreClient circles={[]} people={peopleList} initialView={initialView} place={place} />
    </>
  )

  // Fetch member counts and schedules for all circles in parallel
  const [memberCounts, schedules] = await Promise.all([
    Promise.all(
      circles.map((c) =>
        supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', c.id)
          .then(({ count }) => ({ id: c.id, count: count ?? 0 }))
      )
    ),
    supabase
      .from('circle_schedules')
      .select('circle_id, days_of_week')
      .in('circle_id', circles.map((c) => c.id)),
  ])

  const countMap = Object.fromEntries(memberCounts.map(({ id, count }) => [id, count]))
  const scheduleMap: Record<string, number[]> = {}
  for (const s of schedules.data ?? []) {
    scheduleMap[s.circle_id] = s.days_of_week
  }

  const enriched = circles.map((c) => ({
    ...c,
    member_count: countMap[c.id] ?? 0,
    days_of_week: scheduleMap[c.id] ?? [],
  }))

  return (
    <>
      <TopNav />
      <ExploreClient circles={enriched} people={peopleList} initialView={initialView} place={place} />
    </>
  )
}
