import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'
import HomeCompose from '@/components/HomeCompose'
import PostItem from '@/components/PostItem'
import { todayISO, dayNameISO, daysBetweenISO, relativeDayLabel, formatTime } from '@/lib/schedule'

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
          .select('id, name, emoji, category, location, neighborhood, visibility, kind')
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
  const postIds = feedPosts.map((p) => p.id)

  // Likes and comments, so the feed carries the same affordances as a circle
  // page rather than being a read-only digest.
  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    postIds.length > 0
      ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
    postIds.length > 0
      ? supabase
          .from('post_comments')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const commentIds = (commentRows ?? []).map((c) => c.id)
  const { data: commentLikeRows } = commentIds.length > 0
    ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    : { data: [] as { comment_id: string; user_id: string }[] }

  // Null author = the account was deleted; the post itself was kept.
  const authorIds = [
    ...new Set([
      ...feedPosts.map((p) => p.user_id),
      ...(commentRows ?? []).map((c) => c.user_id),
    ]),
  ].filter((v): v is string => !!v)

  const { data: authors } = authorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] as { id: string; full_name: string }[] }

  const authorMap = Object.fromEntries((authors ?? []).map((a) => [a.id, a.full_name]))
  const authorName = (uid: string | null) => (uid ? authorMap[uid] ?? 'Someone' : 'Deleted user')

  const likeCount: Record<string, number> = {}
  const likedByMe = new Set<string>()
  for (const l of likeRows ?? []) {
    likeCount[l.post_id] = (likeCount[l.post_id] ?? 0) + 1
    if (l.user_id === user.id) likedByMe.add(l.post_id)
  }

  const commentLikeCount: Record<string, number> = {}
  const commentLikedByMe = new Set<string>()
  for (const l of commentLikeRows ?? []) {
    commentLikeCount[l.comment_id] = (commentLikeCount[l.comment_id] ?? 0) + 1
    if (l.user_id === user.id) commentLikedByMe.add(l.comment_id)
  }

  const commentsByPost: Record<string, any[]> = {}
  for (const c of commentRows ?? []) {
    ;(commentsByPost[c.post_id] ??= []).push({
      id: c.id,
      user_id: c.user_id,
      author_name: authorName(c.user_id),
      content: c.content,
      created_at: c.created_at,
      likeCount: commentLikeCount[c.id] ?? 0,
      likedByMe: commentLikedByMe.has(c.id),
    })
  }

  // Upcoming meets. The recurrence maths is in the database, so biweekly and
  // monthly are honoured — this page used to just find the nearest matching
  // weekday and ignore frequency entirely.
  const today = todayISO()
  const { data: nextOccurrences } = circleIds.length > 0
    ? await supabase.rpc('circles_next_occurrence', { cids: circleIds })
    : { data: [] as { circle_id: string; occurs_on: string }[] }

  type Upcoming = {
    circle: any
    schedule: any
    occursOn: string
    daysAway: number
  }

  const upcoming: Upcoming[] = ((nextOccurrences ?? []) as { circle_id: string; occurs_on: string }[])
    .map((n) => ({
      circle: circleMap[n.circle_id],
      schedule: scheduleMap[n.circle_id],
      occursOn: n.occurs_on,
      daysAway: daysBetweenISO(today, n.occurs_on),
    }))
    .filter((u: Upcoming) => u.circle && u.schedule && u.daysAway >= 0 && u.daysAway < 7)
    .sort((a: Upcoming, b: Upcoming) => a.daysAway - b.daysAway)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const myName = profile?.full_name ?? 'You'
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
              <p className="text-muted-foreground text-sm mt-1">{dayNameISO(today)}</p>
            </div>

            <nav className="hidden md:flex flex-col gap-2">
              <Link href="/explore" className={railLink}>explore circles</Link>
              <Link href="/circles/new" className={railLink}>new circle</Link>
              <Link href="/profile" className={railLink}>your profile</Link>
            </nav>

            {/* Your circles lives here now. It used to sit below the feed as a
                nine-row list, which pushed the actual posts off the screen. */}
            {circles.length > 0 && (
              <div className="hidden md:block space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Your circles
                </p>
                <ul className="space-y-1.5">
                  {circles.map((circle) => (
                    <li key={circle.id}>
                      <Link
                        href={`/circles/${circle.id}`}
                        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="w-4 text-center flex-shrink-0">{circle.emoji ?? '●'}</span>
                        <span className="truncate group-hover:underline underline-offset-2">{circle.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Feed */}
          <div className="space-y-6 min-w-0">

            {/* This week — a strip, not a section. Enough to know where to be,
                small enough that the feed still starts near the top. */}
            {upcoming.length > 0 && (
              <div className="flex flex-wrap gap-2 fade-rise">
                {upcoming.slice(0, 4).map(({ circle, occursOn, schedule }) => {
                  const when = relativeDayLabel(occursOn, today)
                  return (
                    <Link
                      key={circle.id}
                      href={`/circles/${circle.id}`}
                      className="flex items-center gap-2 border rounded-full pl-2.5 pr-3 py-1.5 text-xs hover:bg-muted transition-colors min-w-0"
                    >
                      <span className="flex-shrink-0">{circle.emoji ?? '●'}</span>
                      <span className="font-medium truncate">{circle.name}</span>
                      <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                        {when} {formatTime(schedule.start_time)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}

            {circles.length > 0 && (
              <div className="border-b pb-5 fade-rise stagger-1">
                <HomeCompose
                  circles={circles.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))}
                  authorName={myName}
                />
              </div>
            )}

            {circles.length === 0 ? (
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
            ) : feedPosts.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="font-medium">Nothing posted yet</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  When someone in your circles posts, it shows up here. You could go first.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border fade-rise stagger-2">
                {feedPosts.map((p) => {
                  const c = circleMap[p.circle_id]
                  return (
                    <PostItem
                      key={p.id}
                      post={{
                        id: p.id,
                        circleId: p.circle_id,
                        content: p.content,
                        created_at: p.created_at,
                        user_id: p.user_id,
                        author_name: authorName(p.user_id),
                      }}
                      circle={c ? { id: c.id, name: c.name, emoji: c.emoji } : undefined}
                      currentUserId={user.id}
                      currentUserName={myName}
                      initialLikeCount={likeCount[p.id] ?? 0}
                      initialLiked={likedByMe.has(p.id)}
                      initialComments={commentsByPost[p.id] ?? []}
                      canInteract
                    />
                  )
                })}
              </div>
            )}

          </div>
        </div>
      </main>
    </>
  )
}
