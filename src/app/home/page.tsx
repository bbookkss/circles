import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'
import HomeCompose from '@/components/HomeCompose'
import PostItem from '@/components/PostItem'
import CheckInControl from '@/components/CheckInControl'
import { todayISO, daysBetweenISO, relativeDayLabel, formatTime, checkInWindow, meetPhase } from '@/lib/schedule'
import MeetZone from '@/components/MeetZone'
import { cookies } from 'next/headers'

/** ISO date n days after iso. Dates only, so noon UTC sidesteps DST edges. */
function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    .toUpperCase()
}
function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const roleOf = Object.fromEntries((memberships ?? []).map((m) => [m.circle_id, m.role]))

  // The greeting's day name is about the reader, not any circle, so it
  // follows them. Read from the cookie ViewerTimezone writes rather than
  // resolved in the browser: this is server-rendered text, and swapping it
  // after mount would flash a different weekday on every load. The cookie is
  // written on a visitor's very first page, so only a first-ever visit inside
  // the small hours can show the fallback zone's day.
  const viewerTz = (await cookies()).get('viewer_tz')?.value || undefined
  const today = todayISO(viewerTz)

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
  const nextOccurrences = (occurrencesResult.data ?? []) as { circle_id: string; occurs_on: string }[]
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

  const allNext: Upcoming[] = nextOccurrences
    .map((n) => ({
      circle: circleMap[n.circle_id],
      schedule: scheduleMap[n.circle_id],
      occursOn: n.occurs_on,
      daysAway: daysBetweenISO(today, n.occurs_on),
    }))
    .filter((u: Upcoming) => u.circle && u.schedule && u.daysAway >= 0)
    .sort((a: Upcoming, b: Upcoming) => a.daysAway - b.daysAway)

  const upcoming = allNext.filter((u) => u.daysAway < 7)
  // Beyond the week. A monthly circle used to vanish from this page for
  // three weeks in four, with nothing saying it still existed.
  const later = allNext.filter((u) => u.daysAway >= 7)
  const unscheduled = circles.filter((c) => !scheduleMap[c.id])

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
  const firstNameOf = (uid: string) => (uid === user.id ? 'you' : (authorName(uid).split(' ')[0] || 'Someone'))

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

  // The week strip: seven days from today, dots on the days that have a meet.
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i))
  const meetDays = new Set(upcoming.map((u) => u.occursOn))

  const greeting =
    circles.length === 0
      ? `Hey, ${firstName}.`
      : ahead.length === 0
        ? `Nothing on this week, ${firstName}.`
        : ahead.length === 1
          ? `One meet this week, ${firstName}.`
          : `${ahead.length} meets this week, ${firstName}.`

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-5 md:px-6 py-8 md:py-12 space-y-10">

          {/* ---------------------------------------------------------
              The week. The greeting has a verb because the page has a job:
              tell you where to be and who else is coming.
              --------------------------------------------------------- */}
          <section className="space-y-5 fade-rise">
            <h1 className="text-[2rem] md:text-[2.4rem] font-normal leading-tight">
              {greeting.split(firstName)[0]}
              <em className="text-pen italic font-normal">{firstName}.</em>
            </h1>

            {circles.length > 0 && (
              <ol className="grid grid-cols-7 border-t border-foreground border-b">
                {week.map((iso, i) => {
                  const isToday = i === 0
                  return (
                    <li key={iso} className={`py-2.5 text-center ${i < 6 ? 'border-r border-border/60' : ''}`}>
                      <p className="label">{shortDay(iso)}</p>
                      <p className={`font-display font-semibold text-lg leading-tight mt-0.5 ${isToday ? 'inline-block px-2 rounded-sm bg-hi' : ''}`}>
                        {Number(iso.slice(8, 10))}
                      </p>
                      <div className="h-1.5 mt-1.5 flex justify-center">
                        {meetDays.has(iso) && <span className="w-1.5 h-1.5 rounded-full bg-pen" />}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {circles.length > 0 && ahead.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Your circles have no {over.length > 0 ? 'further ' : ''}meets in the next seven days.
              </p>
            )}

            {ahead.length > 0 && (
              <ul className="divide-y divide-border">
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
                  // Day labels are computed in the circle's own timezone,
                  // not the reader's. A Sunday 11am meet in San Francisco is
                  // still "Today" at 1am Monday in New York.
                  const dayWord = relativeDayLabel(occursOn, todayISO(circle.timezone))
                  const yesNames = going.map((r) => firstNameOf(r.user_id))
                  const whoLine =
                    yesNames.length === 0
                      ? 'Nobody has said yes yet'
                      : yesNames.length <= 3
                        ? `${yesNames.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${yesNames.length === 1 && yesNames[0] !== 'you' ? 'is' : 'are'} in`
                        : `${yesNames.slice(0, 2).join(', ')} and ${yesNames.length - 2} more are in`

                  return (
                    <li key={circle.id} className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-x-6 gap-y-2 py-6">
                      <div>
                        <p className="font-display font-semibold text-2xl leading-none">{dayWord}</p>
                        <p className="num text-sm text-foreground/80 mt-1.5">
                          {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                          <MeetZone tz={circle.timezone} />
                        </p>
                        <p className={`label mt-2 ${open ? 'text-pen' : ''}`}>
                          {open ? '● check-in open' : reason ?? ''}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <Link href={`/circles/${circle.id}`} className="hover:underline underline-offset-4 decoration-pen-soft">
                          <h2 className="text-xl md:text-2xl leading-tight">
                            {circle.emoji && <span className="mr-2">{circle.emoji}</span>}
                            {circle.name}
                          </h2>
                        </Link>
                        {where && <p className="text-sm text-foreground/75 mt-0.5 truncate">{where}</p>}
                        <div className="flex items-center gap-3 flex-wrap mt-3.5">
                          <CheckInControl
                            circleId={circle.id}
                            occursOn={occursOn}
                            initialStatus={mine as 'yes' | 'no' | 'maybe' | null}
                            disabled={!open}
                            disabledReason={undefined}
                          />
                          <p className="text-sm text-foreground/75">
                            {whoLine}{maybes.length > 0 ? ` · ${maybes.length} maybe` : ''}
                          </p>
                        </div>
                      </div>
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
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        <span className="flex-shrink-0">{circle.emoji ?? '●'}</span>
                        <span className="truncate">{circle.name}</span>
                        <span className="num text-xs flex-shrink-0">· finished {formatTime(schedule.start_time)}</span>
                        {went > 0 && <span className="text-xs flex-shrink-0">· {went} went</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {(later.length > 0 || unscheduled.length > 0) && (
              <div className="pt-2">
                <p className="label mb-2">Later</p>
                <ul className="divide-y divide-dashed divide-border">
                  {later.map(({ circle, occursOn }) => (
                    <li key={circle.id} className="grid grid-cols-[110px_1fr] md:grid-cols-[150px_1fr] gap-x-6 py-2 text-sm">
                      <span className="num text-foreground">{shortDate(occursOn)}</span>
                      <Link href={`/circles/${circle.id}`} className="text-foreground/80 hover:text-foreground truncate">
                        {circle.name}
                        {scheduleMap[circle.id]?.frequency && scheduleMap[circle.id].frequency !== 'weekly' && (
                          <span className="text-muted-foreground"> · {scheduleMap[circle.id].frequency === 'biweekly' ? 'every other week' : 'monthly'}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                  {unscheduled.map((circle) => (
                    <li key={circle.id} className="grid grid-cols-[110px_1fr] md:grid-cols-[150px_1fr] gap-x-6 py-2 text-sm">
                      <span className="num text-muted-foreground">—</span>
                      <span className="text-foreground/80">
                        {circle.name} has no schedule yet.{' '}
                        {roleOf[circle.id] === 'admin' ? (
                          <Link href={`/circles/${circle.id}/edit`} className="underline underline-offset-4 decoration-pen-soft hover:text-foreground">Set one</Link>
                        ) : (
                          'Ask its admin to set one.'
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {circles.length === 0 && (
              <div className="border-t border-b py-10 space-y-3">
                <p className="font-display text-xl">You haven&apos;t joined a circle yet.</p>
                <p className="text-sm text-foreground/75 max-w-md">
                  Circles are groups that meet at the same place on a regular schedule. Find one near you, or start the first.
                </p>
                <div className="flex gap-2 pt-1">
                  <Link href="/explore"><Button size="sm">Find circles near me</Button></Link>
                  <Link href="/circles/new"><Button size="sm" variant="outline">Start one</Button></Link>
                </div>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------
              Notes. Secondary to the week, but still the full PostItem
              treatment rather than a read-only digest.
              --------------------------------------------------------- */}
          {circles.length > 0 && (
            <section className="space-y-5">
              <p className="label">Notes from your circles</p>

              <div className="border-b pb-5 fade-rise stagger-1">
                <HomeCompose
                  circles={circles.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))}
                  authorName={myName}
                />
              </div>

              {feedPosts.length === 0 ? (
                <div className="py-8 space-y-1">
                  <p className="font-display text-lg">Nothing posted yet.</p>
                  <p className="text-sm text-foreground/75">When someone in your circles leaves a note, it shows up here. You could go first.</p>
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
          )}

        </div>
      </main>
    </>
  )
}
