import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ExploreClient from './ExploreClient'
import { geoFromHeaders, resolveMapView } from '@/lib/mapView'

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

  // Decision and header parsing both live in lib/mapView so they can be
  // tested without a request; this only supplies the inputs.
  const h = await headers()
  const { view: initialView, place } = resolveMapView(
    myCircles ?? [],
    geoFromHeaders((name) => h.get(name))
  )

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
