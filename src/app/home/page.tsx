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

function formatTimeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
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
  const circleMap = Object.fromEntries(circles.map((c) => [c.id, c]))

  // Recent posts from the circles this user belongs to — the home feed
  const { data: feedPostsRaw } = circleIds.length > 0
    ? await supabase
        .from('posts')
        .select('id, content, created_at, user_id, circle_id')
        .in('circle_id', circleIds)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] as any[] }

  const feedPosts = feedPostsRaw ?? []
  const feedAuthorIds = [...new Set(feedPosts.map((p) => p.user_id))]
  const { data: feedAuthors } = feedAuthorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', feedAuthorIds)
    : { data: [] as { id: string; full_name: string }[] }
  const authorMap = Object.fromEntries((feedAuthors ?? []).map((a) => [a.id, a.full_name]))

  const feed = feedPosts.map((p) => {
    const c = circleMap[p.circle_id]
    return {
      ...p,
      author_name: authorMap[p.user_id] ?? 'Someone',
      circle_name: c?.name ?? 'a circle',
      circle_emoji: c?.emoji ?? '●',
    }
  })

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

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const railLink = 'text-sm text-muted-foreground hover:text-foreground transition-colors w-fit'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[190px_1fr] gap-6 md:gap-16">

          {/* Left rail (becomes a compact header on mobile) */}
          <aside className="md:sticky md:top-24 h-fit space-y-8 fade-rise">
            <div>
              <h1 className="text-2xl font-bold lowercase leading-tight">hey, {firstName}</h1>
              <p className="text-muted-foreground text-sm mt-1">{DAY_NAMES[todayIdx]}</p>
            </div>
            {/* Desktop-only rail extras — on mobile the top nav already covers these */}
            <nav className="hidden md:flex flex-col gap-2">
              <Link href="/explore" className={railLink}>explore circles</Link>
              <Link href="/circles/new" className={railLink}>new circle</Link>
              <Link href="/profile" className={railLink}>your profile</Link>
            </nav>
            <p className="hidden md:block text-xs text-muted-foreground">
              {circles.length} circle{circles.length !== 1 ? 's' : ''} joined
            </p>
          </aside>

          {/* Feed */}
          <div className="space-y-12 min-w-0">

            {/* This week */}
            {upcoming.length > 0 && (
              <section className="fade-rise stagger-1">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">This week</h2>
                <div className="divide-y divide-border border-t border-b">
                  {upcoming.map(({ circle, daysAway, schedule }) => {
                    const isToday = daysAway === 0
                    const dayLabel = isToday ? 'Today' : daysAway === 1 ? 'Tomorrow' : DAY_SHORT[(todayIdx + daysAway) % 7]
                    return (
                      <Link
                        key={circle.id}
                        href={`/circles/${circle.id}`}
                        className="group flex items-center gap-4 py-3.5"
                      >
                        <span className="w-6 text-center text-lg flex-shrink-0">{circle.emoji ?? '●'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate group-hover:underline underline-offset-2">{circle.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {schedule.start_time && schedule.end_time
                              ? `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`
                              : 'Scheduled'}
                            {circle.neighborhood ? ` · ${circle.neighborhood}` : circle.location ? ` · ${circle.location}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs flex-shrink-0 tabular-nums ${isToday ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                          {dayLabel}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Feed */}
            {feed.length > 0 && (
              <section className="fade-rise stagger-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Latest</h2>
                <div className="divide-y divide-border border-t border-b">
                  {feed.map((post) => (
                    <article key={post.id} className="py-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 flex-wrap">
                        <Link href={`/circles/${post.circle_id}`} className="font-medium text-foreground hover:underline underline-offset-2">
                          <span className="mr-1">{post.circle_emoji}</span>{post.circle_name}
                        </Link>
                        <span>·</span>
                        <Link href={`/profile/${post.user_id}`} className="hover:underline underline-offset-2">{post.author_name}</Link>
                        <span>·</span>
                        <span className="tabular-nums">{formatTimeAgo(post.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{post.content}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Your circles */}
            <section className="fade-rise stagger-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Your circles</h2>
              {circles.length > 0 ? (
                <div className="divide-y divide-border border-t border-b">
                  {circles.map((circle) => {
                    const membership = memberships?.find((m) => m.circle_id === circle.id)
                    return (
                      <Link
                        key={circle.id}
                        href={`/circles/${circle.id}`}
                        className="group flex items-center gap-4 py-3.5"
                      >
                        <span className="w-6 text-center text-lg flex-shrink-0">{circle.emoji ?? '●'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate group-hover:underline underline-offset-2">{circle.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[circle.category, circle.neighborhood ?? circle.location].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {membership?.role === 'admin' && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">admin</span>
                        )}
                        {circle.visibility === 'private' && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">private</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="border-t border-b py-10 text-center space-y-3">
                  <p className="font-medium">You haven&apos;t joined any circles yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Circles are recurring local groups. Sports, music, dinners, anything that happens on a regular schedule.
                  </p>
                  <div className="flex gap-2 justify-center pt-1">
                    <Link href="/explore"><Button size="sm">Find circles near me</Button></Link>
                    <Link href="/circles/new"><Button size="sm" variant="outline">Start one</Button></Link>
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </main>
    </>
  )
}
