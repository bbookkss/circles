import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'
import HomeCompose from '@/components/HomeCompose'
import PostItem from '@/components/PostItem'
import CheckInControl from '@/components/CheckInControl'
import { todayISO, dayNameISO, daysBetweenISO, relativeDayLabel, formatTime, checkInWindow, meetPhase } from '@/lib/schedule'

export default async function HomePage() {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  // ---------------------------------------------------------------------
  // Fetching is arranged in waves rather than one query after another.
  //
  // Every query here takes ~34ms against Supabase, so ten in series is ~340ms
  // of the page doing nothing but waiting. Each wave below is one round trip's
  // worth of latency, and a query only sits in a later wave when it genuinely
  // needs something the earlier one produced.
  // ---------------------------------------------------------------------

  // Wave 1 — both keyed off the user id, neither needs the other.
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('circle_members').select('circle_id, role').eq('user_id', user.id),
  ])

  const circleIds = memberships?.map((m) => m.circle_id) ?? []
  const hasCircles = circleIds.length > 0
  const today = todayISO()

  // Wave 2 — everything that needs only the circle ids. The recurrence maths
  // stays in the database, so biweekly and monthly are honoured; this page
  // used to just find the nearest matching weekday and ignore frequency.
  const [circlesResult, schedulesResult, occurrencesResult, postsResult] = await Promise.all([
    hasCircles
      ? supabase
          .from('circles')
          .select('id, name, emoji, category, location, neighborhood, visibility, kind, timezone')
          .in('id', circleIds)
      : Promise.resolve({ data: [] as any[] }),
    hasCircles
      ? supabase
          .from('circle_schedules')
          .select('circle_id, days_of_week, start_time, end_time, frequency')
          .in('circle_id', circleIds)
      : Promise.resolve({ data: [] as any[] }),
    hasCircles
      ? supabase.rpc('circles_next_occurrence', { cids: circleIds })
      : Promise.resolve({ data: [] as { circle_id: string; occurs_on: string }[] }),
    hasCircles
      ? supabase
          .from('posts')
          .select('id, content, created_at, user_id, circle_id')
          .in('circle_id', circleIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const circles = circlesResult.data ?? []
  const schedules = schedulesResult.data ?? []
  const nextOccurrences = occurrencesResult.data ?? []
  const feedPosts = postsResult.data ?? []
  const postIds = feedPosts.map((p: { id: string }) => p.id)

  const scheduleMap = Object.fromEntries(schedules.map((s) => [s.circle_id, s]))
  const circleMap = Object.fromEntries(circles.map((c) => [c.id, c]))

  type Upcoming = {
    circle: any
    schedule: any
    occursOn: string
    daysAway: number
  }

  const upcoming: Upcoming[] = (nextOccurrences as { circle_id: string; occurs_on: string }[])
    .map((n) => ({
      circle: circleMap[n.circle_id],
      schedule: scheduleMap[n.circle_id],
      occursOn: n.occurs_on,
      daysAway: daysBetweenISO(today, n.occurs_on),
    }))
    .filter((u: Upcoming) => u.circle && u.schedule && u.daysAway >= 0 && u.daysAway < 7)
    .sort((a: Upcoming, b: Upcoming) => a.daysAway - b.daysAway)

  // A meet stays the circle's "next occurrence" until local midnight, so
  // without this split a finished meet would hold a full card for the rest of
  // the day. It keeps a one-line record instead, and goes when the date rolls.
  const isOver = (u: Upcoming) =>
    meetPhase(u.occursOn, u.schedule.start_time, u.schedule.end_time, u.circle.timezone) === 'finished'
  const ahead = upcoming.filter((u) => !isOver(u))
  const over = upcoming.filter(isOver)

  const upcomingDates = [...new Set(upcoming.map((u) => u.occursOn))]

  // Wave 3 — check-ins need the occurrences, likes and comments need the post
  // ids. Different inputs, same wave, because none of them needs another.
  const [{ data: checkInRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    upcoming.length > 0
      ? supabase
          .from('circle_check_ins')
          .select('circle_id, user_id, occurs_on, status')
          .in('circle_id', upcoming.map((u) => u.circle.id))
          .in('occurs_on', upcomingDates)
      : Promise.resolve({ data: [] as { circle_id: string; user_id: string; occurs_on: string; status: string }[] }),
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

  const meetKey = (circleId: string, occursOn: string) => `${circleId}|${occursOn}`
  const checkInsByMeet: Record<string, { user_id: string; status: string }[]> = {}
  for (const r of checkInRows ?? []) {
    ;(checkInsByMeet[meetKey(r.circle_id, r.occurs_on)] ??= []).push({
      user_id: r.user_id,
      status: r.status,
    })
  }

  const commentIds = (commentRows ?? []).map((c) => c.id)

  // One profile lookup covering post authors, commenters and everyone who has
  // checked in. Null author = the account was deleted; the post was kept.
  const authorIds = [
    ...new Set([
      ...feedPosts.map((p: { user_id: string | null }) => p.user_id),
      ...(commentRows ?? []).map((c) => c.user_id),
      ...(checkInRows ?? []).map((r) => r.user_id),
    ]),
  ].filter((v): v is string => !!v)

  // Wave 4 — comment likes need the comment ids, profiles need the author ids
  // gathered from all three of the above.
  const [{ data: commentLikeRows }, { data: authors }] = await Promise.all([
    commentIds.length > 0
      ? supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : Promise.resolve({ data: [] as { comment_id: string; user_id: string }[] }),
    authorIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

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

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const myName = profile?.full_name ?? 'You'
  const railLink = 'text-sm text-muted-foreground hover:text-foreground transition-colors w-fit'
  const sectionLabel = 'text-xs font-semibold text-muted-foreground uppercase tracking-widest'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[230px_1fr] gap-6 md:gap-14">

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

            {/* Your circles lives here rather than below the feed, where it
                used to push the actual content off the screen. */}
            {circles.length > 0 && (
              <div className="hidden md:block space-y-2">
                <p className={sectionLabel}>Your circles</p>
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

          <div className="space-y-10 min-w-0">

            {/* ---------------------------------------------------------
                This week. The meets are the page: each one is answerable
                here, so home tells you where to be and who else is coming
                without opening a circle.
                --------------------------------------------------------- */}
            {circles.length > 0 && (
              <section className="space-y-3 fade-rise">
                <p className={sectionLabel}>This week</p>

                {ahead.length === 0 && (
                  <div className="border rounded-xl px-4 py-8 text-center space-y-1">
                    <p className="text-sm font-medium">
                      Nothing {over.length > 0 ? 'else ' : ''}on this week
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your circles have no {over.length > 0 ? 'further ' : ''}meets in the next seven days.
                    </p>
                  </div>
                )}

                {ahead.length > 0 && (
                  <ul className="space-y-3">
                    {ahead.map(({ circle, schedule, occursOn }) => {
                      const rows = checkInsByMeet[meetKey(circle.id, occursOn)] ?? []
                      const going = rows.filter((r) => r.status === 'yes')
                      const maybes = rows.filter((r) => r.status === 'maybe')
                      const mine = rows.find((r) => r.user_id === user.id)?.status ?? null
                      // Real hours, not calendar days: a meet "tomorrow" at
                      // 5:30pm is 31 hours away this morning, which the
                      // trigger rejects. The database is the gate; this just
                      // avoids offering a button certain to fail.
                      const { open, reason } = checkInWindow(
                        occursOn,
                        schedule.start_time,
                        schedule.end_time,
                        circle.timezone
                      )
                      const where = circle.neighborhood ?? circle.location

                      return (
                        <li key={circle.id} className="border rounded-xl p-4 space-y-3 bg-card">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <Link
                                href={`/circles/${circle.id}`}
                                className="flex items-center gap-2 font-semibold hover:underline underline-offset-2"
                              >
                                <span className="flex-shrink-0">{circle.emoji ?? '●'}</span>
                                <span className="truncate">{circle.name}</span>
                              </Link>
                              {where && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{where}</p>
                              )}
                            </div>
                            <p className="text-sm text-right flex-shrink-0 tabular-nums">
                              <span className="font-medium">{relativeDayLabel(occursOn, today)}</span>
                              <span className="text-muted-foreground">
                                {' '}{formatTime(schedule.start_time)}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-end justify-between gap-4 flex-wrap">
                            <CheckInControl
                              circleId={circle.id}
                              occursOn={occursOn}
                              initialStatus={mine as 'yes' | 'no' | 'maybe' | null}
                              disabled={!open}
                              disabledReason={reason}
                            />
                            <p className="text-xs text-muted-foreground">
                              {going.length} going{maybes.length > 0 ? ` · ${maybes.length} maybe` : ''}
                            </p>
                          </div>

                          {going.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t">
                              {going.map((r) => (
                                <span key={r.user_id} className="text-xs text-muted-foreground">
                                  {r.user_id === user.id ? 'You' : authorName(r.user_id)}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {over.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {over.map(({ circle, schedule, occursOn }) => {
                      const went = (checkInsByMeet[meetKey(circle.id, occursOn)] ?? [])
                        .filter((r) => r.status === 'yes').length
                      return (
                        <li key={circle.id}>
                          <Link
                            href={`/circles/${circle.id}`}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                          >
                            <span className="flex-shrink-0">{circle.emoji ?? '●'}</span>
                            <span className="truncate">{circle.name}</span>
                            <span className="flex-shrink-0">
                              · finished {formatTime(schedule.start_time)}
                            </span>
                            {went > 0 && (
                              <span className="flex-shrink-0">· {went} went</span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* ---------------------------------------------------------
                Chatter. Secondary to the week, but still the full PostItem
                treatment rather than a read-only digest.
                --------------------------------------------------------- */}
            <section className="space-y-5">
              {circles.length > 0 && <p className={sectionLabel}>Chatter</p>}

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
            </section>

          </div>
        </div>
      </main>
    </>
  )
}
