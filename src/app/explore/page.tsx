import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ExploreClient from './ExploreClient'
import { geoFromHeaders, resolveMapView } from '@/lib/mapView'

export default async function ExplorePage() {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  // Wave 1 — nothing here needs anything from the others.
  const [{ data: circles }, { data: people }, { data: myMemberships }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, description, category, emoji, location, neighborhood, city, latitude, longitude, kind')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    supabase
      .from('profiles')
      .select('id, full_name, instagram')
      .neq('id', user.id),
    // The circles this user is already in are the best guess at where they are.
    supabase.from('circle_members').select('circle_id').eq('user_id', user.id),
  ])

  const peopleList = (people ?? []).filter((p) => p.full_name)
  const myCircleIds = (myMemberships ?? []).map((m) => m.circle_id)
  const circleIds = (circles ?? []).map((c) => c.id)

  // Wave 2 — member counts and schedules for the pins, plus the coordinates of
  // this user's own circles for the initial view.
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
      ? supabase
          .from('circles')
          .select('latitude, longitude')
          .in('id', myCircleIds)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
      : Promise.resolve({ data: [] as { latitude: number | null; longitude: number | null }[] }),
  ])

  // Decision and header parsing both live in lib/mapView so they can be
  // tested without a request; this only supplies the inputs.
  const h = await headers()
  const { view: initialView, place } = resolveMapView(
    myCirclesResult.data ?? [],
    geoFromHeaders((name) => h.get(name))
  )

  if (!circles) return (
    <>
      <TopNav />
      <ExploreClient circles={[]} people={peopleList} initialView={initialView} place={place} />
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
