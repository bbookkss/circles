import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id, role')
    .eq('user_id', user.id)

  const circleIds = memberships?.map((m) => m.circle_id) ?? []

  const [circlesResult, schedulesResult] = await Promise.all([
    circleIds.length > 0
      ? supabase
          .from('circles')
          .select('id, name, emoji, category, location, neighborhood, visibility')
          .in('id', circleIds)
      : Promise.resolve({ data: [] as any[] }),
    circleIds.length > 0
      ? supabase
          .from('circle_schedules')
          .select('circle_id, days_of_week, start_time, end_time, frequency')
          .in('circle_id', circleIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const circles = circlesResult.data ?? []
  const schedules = schedulesResult.data ?? []

  const scheduleMap = Object.fromEntries(schedules.map((s) => [s.circle_id, s]))

  // Figure out upcoming meets in the next 7 days
  const todayIdx = new Date().getDay() // 0=Sun
  const upcoming: { circle: typeof circles[0]; daysAway: number; schedule: typeof schedules[0] }[] = []

  for (const circle of circles) {
    const sched = scheduleMap[circle.id]
    if (!sched?.days_of_week?.length) continue
    // Find the nearest upcoming day (including today)
    let minDaysAway = Infinity
    for (const day of sched.days_of_week) {
      const diff = (day - todayIdx + 7) % 7
      if (diff < minDaysAway) minDaysAway = diff
    }
    if (minDaysAway <= 6) {
      upcoming.push({ circle, daysAway: minDaysAway, schedule: sched })
    }
  }
  upcoming.sort((a, b) => a.daysAway - b.daysAway)

  const meetingToday = upcoming.filter((u) => u.daysAway === 0)
  const meetingSoon = upcoming.filter((u) => u.daysAway > 0 && u.daysAway <= 6)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          <div>
            <h1 className="text-2xl font-bold mb-1">Hey, {firstName}</h1>
            <p className="text-muted-foreground text-sm">{DAY_NAMES[todayIdx]}</p>
          </div>

          {/* Today's meets */}
          {meetingToday.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Today</p>
              <div className="space-y-2">
                {meetingToday.map(({ circle, schedule }) => (
                  <Link
                    key={circle.id}
                    href={`/circles/${circle.id}`}
                    className="flex items-center gap-4 border rounded-xl px-4 py-3 hover:bg-muted transition-colors bg-muted/40"
                  >
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-xl flex-shrink-0 border">
                      {circle.emoji ?? '●'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{circle.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.start_time && schedule.end_time
                          ? `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`
                          : 'Meets today'}
                        {circle.neighborhood ? ` · ${circle.neighborhood}` : circle.location ? ` · ${circle.location}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0">Today</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Coming up this week */}
          {meetingSoon.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">This week</p>
              <div className="space-y-2">
                {meetingSoon.map(({ circle, daysAway, schedule }) => {
                  const dayLabel = daysAway === 1 ? 'Tomorrow' : DAY_SHORT[(todayIdx + daysAway) % 7]
                  return (
                    <Link
                      key={circle.id}
                      href={`/circles/${circle.id}`}
                      className="flex items-center gap-4 border rounded-xl px-4 py-3 hover:bg-muted transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0">
                        {circle.emoji ?? '●'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{circle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.start_time && schedule.end_time
                            ? `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`
                            : 'Scheduled'}
                          {circle.neighborhood ? ` · ${circle.neighborhood}` : circle.location ? ` · ${circle.location}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{dayLabel}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* All circles */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your circles</p>
            {circles.length > 0 ? (
              <ul className="space-y-2">
                {circles.map((circle) => {
                  const membership = memberships?.find((m) => m.circle_id === circle.id)
                  return (
                    <li key={circle.id}>
                      <Link
                        href={`/circles/${circle.id}`}
                        className="flex items-center gap-4 border rounded-xl px-4 py-3 hover:bg-muted transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0">
                          {circle.emoji ?? '●'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{circle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[circle.category, circle.neighborhood ?? circle.location].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {membership?.role === 'admin' && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full border">Admin</span>
                          )}
                          {circle.visibility === 'private' && (
                            <span className="text-xs text-muted-foreground">🔒</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="border rounded-xl p-8 text-center space-y-3">
                <p className="text-3xl">🔵</p>
                <p className="font-semibold text-base">You haven&apos;t joined any circles yet</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Circles are recurring local groups — sports, music, dinners, anything that happens on a regular schedule.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <Link href="/explore"><Button>Find circles near me</Button></Link>
                  <Link href="/circles/new"><Button variant="outline">Start one</Button></Link>
                </div>
                <Link href="/welcome" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground block pt-1">
                  How does this work?
                </Link>
              </div>
            )}
          </section>

          {circles.length > 0 && (
            <div className="flex gap-2 pb-4">
              <Link href="/explore"><Button variant="outline">Explore more</Button></Link>
              <Link href="/circles/new"><Button>+ New circle</Button></Link>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
