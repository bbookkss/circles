import { notFound } from 'next/navigation'
import OfficialAvatar from '@/components/OfficialAvatar'
import { isOfficial } from '@/lib/official'
import OfficialBadge from '@/components/OfficialBadge'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { geoFromHeaders, distanceKm } from '@/lib/mapView'
import { Button } from '@/components/ui/button'
import { joinCircle, leaveCircle, requestToJoin, withdrawRequest } from '@/app/actions/circles'
import TopNav from '@/components/TopNav'
import PostCompose from '@/components/PostCompose'
import PostItem from '@/components/PostItem'
import CopyLinkButton from '@/components/CopyLinkButton'
import FollowButton from '@/components/FollowButton'
import BackButton from '@/components/BackButton'
import CircleLocationMap from '@/components/map/CircleLocationMap'
import Logo from '@/components/Logo'
import { BLUR_RADIUS_M, type CirclePlace } from '@/lib/approxLocation'
import CheckInControl from '@/components/CheckInControl'
import { relativeDayLabel, dayNameISO, checkInWindow } from '@/lib/schedule'
import MeetZone from '@/components/MeetZone'
import DistanceFromYou from '@/components/DistanceFromYou'
import AttendanceRegister from '@/components/AttendanceRegister'
import RoleToggle from '@/components/RoleToggle'
import ReportButton from '@/components/ReportButton'

// Everything on circles except the exact place, which only members may read
// (location-lockdown-2026-11-18.sql). Members get it from circle_places().
const CIRCLE_COLUMNS =
  'id, name, description, category, emoji, neighborhood, city, visibility, kind, timezone, created_by, area_latitude, area_longitude'

/** A circles row as selected above, or the slimmer row circle_preview() returns. */
type CircleView = {
  id: string
  name: string
  description: string | null
  category: string | null
  emoji: string | null
  neighborhood: string | null
  visibility: string
  kind: string
  city?: string | null
  timezone?: string
  created_by?: string | null
  area_latitude?: number | null
  area_longitude?: number | null
  member_count?: number
  creator_name?: string | null
}

const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** meets_attended is tenure; committed and kept are the promise and the keeping. */
type MemberStats = { user_id: string; meets_attended: number; committed: number; kept: number }

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

/** "Saturday 13 Sep". Noon UTC so a date-only value cannot slip a day. */
function longDateISO(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/**
 * "Fridays, 11pm – 1am" / "Mondays and Wednesdays every other week, 7 – 8pm".
 * A sentence, because "Fri · 11pm – 1am · Weekly" is a database row wearing
 * a hat. The frequency only appears when it is not the obvious one.
 */
function meetsPhrase(s: { days_of_week: number[]; start_time: string; end_time: string; frequency: string }) {
  const days = [...s.days_of_week].sort().map((d) => `${DAY_LONG[d]}s`)
  const freq = s.frequency === 'biweekly' ? ' every other week' : s.frequency === 'monthly' ? ' monthly' : ''
  return `${listJoin(days)}${freq}, ${formatTime(s.start_time)} – ${formatTime(s.end_time)}`
}

function Initials({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={`rounded-full bg-cool-2 flex items-center justify-center font-medium flex-shrink-0 ${size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'}`}>
      {initials}
    </div>
  )
}

export default async function CirclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  // joinCircle / leaveCircle / requestToJoin redirect here with a message
  // when the write was refused, instead of redirecting here as if it worked.
  const { error: actionError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: fullCircle } = await supabase
    .from('circles')
    .select(CIRCLE_COLUMNS)
    .eq('id', id)
    .single()

  // Under RLS a private circle is invisible to everyone but its members, so
  // the select above returns nothing for outsiders. Fall back to the preview
  // RPC (security definer, preview columns only — no coordinates) so a shared
  // link still renders a join prompt instead of a 404.
  let circle: CircleView | null = fullCircle
  let isPreviewOnly = false
  if (!circle) {
    const { data: preview } = await supabase
      .rpc('circle_preview', { circle_id: id })
      .maybeSingle()
    if (preview) {
      circle = preview as CircleView
      isPreviewOnly = true
    }
  }

  if (!circle) notFound()

  const isPrivate = circle.visibility === 'private'

  // Data available to everyone. A preview-only circle also hides its members
  // and schedule, so the count comes from the RPC and schedules stay empty.
  const [{ count: memberCountRaw }, { data: schedules }] = await Promise.all([
    // circle_id only: anon is granted that single column so it can count
    // members without being able to enumerate who they are.
    supabase.from('circle_members').select('circle_id', { count: 'exact', head: true }).eq('circle_id', id),
    supabase.from('circle_schedules').select('*').eq('circle_id', id),
  ])
  const memberCount = isPreviewOnly ? (circle.member_count as number) : memberCountRaw

  const { data: creator } = isPreviewOnly
    ? { data: { full_name: circle.creator_name as string | null } }
    : await supabase
        .from('profiles').select('full_name').eq('id', circle.created_by).maybeSingle()

  // A signed-in outsider looking at a private circle only has the preview too,
  // so they get this branch as well — with a request-to-join CTA.
  const { data: previewJoinRequest } = user && isPreviewOnly
    ? await supabase
        .from('circle_join_requests')
        .select('status').eq('circle_id', id).eq('user_id', user.id).maybeSingle()
    : { data: null }

  // The exact point and venue name. The database returns them only to
  // members, so for everyone else this is empty and they get the area.
  const { data: places } = user && !isPreviewOnly
    ? await supabase.rpc('circle_places', { cids: [id] })
    : { data: null }
  const exact = ((places ?? []) as CirclePlace[])[0] ?? null
  const exactPoint =
    exact && exact.latitude != null && exact.longitude != null
      ? { latitude: exact.latitude, longitude: exact.longitude }
      : null
  // Displaced on write by the database; a preview carries none.
  const area =
    circle.area_latitude != null && circle.area_longitude != null
      ? { latitude: circle.area_latitude as number, longitude: circle.area_longitude as number, radiusM: BLUR_RADIUS_M }
      : null

  const schedule = schedules?.[0] ?? null
  const place = exact?.location ?? circle.neighborhood ?? null
  const creatorFirst = creator?.full_name?.split(' ')[0] ?? null
  const count = memberCount ?? 0

  // "about 2.3 mi from you", from the IP's city-level guess. Members get it
  // against the real point; everyone else against the blurred area, which is
  // why it always says "about": the number is honest to roughly half a mile
  // either way, and the blur is the reason for the second half of that.
  const h = await headers()
  const geo = geoFromHeaders((name) => h.get(name))
  const fromYou = (lat: number, lng: number): string | null => {
    if (!geo) return null
    const mi = distanceKm(geo, { latitude: lat, longitude: lng }) * 0.621371
    const n = mi < 0.1 ? 'under a tenth of a mile' : mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`
    return `about ${n} from you`
  }

  // Unauthenticated, or signed in without access — show preview card
  if (!user || isPreviewOnly) {
    // Nobody on this branch is a member, so the location is always the area.
    const previewArea = area
    return (
      <>
        {user ? <TopNav /> : (
          <nav className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-50 h-14 px-3 pt-2 pointer-events-none">
            <div className="glass pointer-events-auto mx-auto max-w-3xl h-12 rounded-full flex items-center gap-2 pl-4 pr-1.5">
              <Link href="/" className="flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight"><Logo />Circles</Link>
              <div className="ml-auto flex items-center gap-1">
                <Link href="/login" className="text-sm px-3 py-2 rounded-full hover:bg-muted">Log in</Link>
                <Link href="/signup" className="text-sm font-medium px-4 py-2 rounded-full bg-foreground text-background">Sign up</Link>
              </div>
            </div>
          </nav>
        )}
        <div className="pt-14 max-md:pb-[calc(var(--tabbar)+2rem)] md:pb-0 min-h-screen bg-background">
          <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">

            {actionError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3.5 py-2.5 rounded-xl">
                {actionError}
              </p>
            )}

            {/* Masthead */}
            <header className="space-y-3 fade-rise pb-2">
              <p className="text-[15px] text-muted-foreground">
                {[circle.category, isPrivate ? 'private' : 'public', circle.kind === 'commercial' ? 'business' : null]
                  .filter(Boolean).join(', ')}
              </p>
              <h1 className="text-[2.4rem] md:text-[3.25rem]">
                {circle.emoji && <span className="mr-3">{circle.emoji}</span>}{circle.name}
              </h1>
              <p className="text-base text-muted-foreground mt-2 max-w-prose">
                {schedule ? (
                  <>Meets <b className="font-medium text-foreground">{meetsPhrase(schedule)}</b>{place ? ` at ${place}` : ''}. </>
                ) : (
                  <>No schedule yet. </>
                )}
                {creatorFirst && <>Started by {creatorFirst}{isOfficial(circle.created_by) && <OfficialBadge />}. </>}
                {count} member{count !== 1 ? 's' : ''}.
              </p>
              {circle.description && <p className="text-muted-foreground max-w-prose">{circle.description}</p>}
            </header>

            {/* Location map */}
            {previewArea && (
              <div className="fade-rise stagger-1">
                <p className="label mb-2">Where</p>
                <div className="h-52 rounded-2xl overflow-hidden">
                  <CircleLocationMap
                    longitude={previewArea.longitude}
                    latitude={previewArea.latitude}
                    radiusM={previewArea.radiusM}
                    emoji={circle.emoji}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {circle.neighborhood && <span>{circle.neighborhood}, </span>}
                  <DistanceFromYou
                    latitude={previewArea.latitude}
                    longitude={previewArea.longitude}
                    initial={fromYou(previewArea.latitude, previewArea.longitude)}
                  />
                  {geo && ', '}exact spot shown to members
                </p>
              </div>
            )}

            {/* Join CTA */}
            <div className="rounded-3xl bg-muted p-6 space-y-4 fade-rise stagger-2">
              <div>
                <p className="text-xl font-medium tracking-tight">
                  {isPrivate ? 'Want to join this circle?' : 'Join this circle'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {user
                    ? 'Ask the admin for access to see members and notes.'
                    : isPrivate
                      ? 'Create an account to request access. The admin will approve you.'
                      : 'Create a free account to join and see notes from this circle.'}
                </p>
              </div>
              <div className="flex gap-2">
                {user ? (
                  previewJoinRequest?.status === 'pending' ? (
                    <form action={withdrawRequest}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button variant="outline" type="submit">Withdraw request</Button>
                    </form>
                  ) : (
                    <form action={requestToJoin}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button type="submit">Request to join</Button>
                    </form>
                  )
                ) : (
                  <>
                    <Link href={`/signup`}>
                      <Button>Create account</Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="outline">Sign in</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {user && (
              <div className="text-xs">
                <ReportButton targetType="circle" targetId={id} label="Report this circle" />
              </div>
            )}

          </div>
        </div>
      </>
    )
  }

  // Authenticated — full page
  const [
    { data: membership },
    { data: joinRequest },
    { data: rawPosts },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from('circle_members').select('role').eq('circle_id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('circle_join_requests').select('status').eq('circle_id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('posts').select('id, content, created_at, user_id').eq('circle_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('circle_members').select('user_id, role').eq('circle_id', id).limit(24),
  ])

  const postIds = (rawPosts ?? []).map((p) => p.id)

  // Likes + comments for the visible posts
  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    postIds.length > 0
      ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)
      : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
    postIds.length > 0
      ? supabase.from('post_comments').select('id, post_id, user_id, content, created_at').in('post_id', postIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; post_id: string; user_id: string; content: string; created_at: string }[] }),
  ])

  // Likes on the visible comments
  const commentIds = (commentRows ?? []).map((c) => c.id)
  const { data: commentLikeRows } = commentIds.length > 0
    ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    : { data: [] as { comment_id: string; user_id: string }[] }

  const memberUserIds = (memberRows ?? []).map((m) => m.user_id)
  const postAuthorIds = (rawPosts ?? []).map((p) => p.user_id)
  const commentAuthorIds = (commentRows ?? []).map((c) => c.user_id)
  // A deleted account leaves user_id null on its posts and comments, and
  // created_by null on its circles. Those must not reach the .in() filter.
  const allProfileIds = [...new Set([...memberUserIds, ...postAuthorIds, ...commentAuthorIds, circle.created_by])]
    .filter((v): v is string => !!v)

  const [{ data: profiles }, { data: myFollows }, { data: myProfile }] = await Promise.all([
    allProfileIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', allProfileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    memberUserIds.length > 0
      ? supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', memberUserIds)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))
  // Null author = the account was deleted; the post itself was kept.
  const authorName = (uid: string | null) => (uid ? profileMap[uid] ?? 'Someone' : 'Deleted user')
  const followingSet = new Set((myFollows ?? []).map((f) => f.following_id))

  const members = (memberRows ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    full_name: profileMap[m.user_id] ?? 'Member',
    isMe: m.user_id === user.id,
    isFollowing: followingSet.has(m.user_id),
  }))

  // Aggregate likes and comments per post
  const likeCountMap: Record<string, number> = {}
  const likedByMe = new Set<string>()
  for (const l of likeRows ?? []) {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] ?? 0) + 1
    if (l.user_id === user.id) likedByMe.add(l.post_id)
  }

  const commentLikeCount: Record<string, number> = {}
  const commentLikedByMe = new Set<string>()
  for (const l of commentLikeRows ?? []) {
    commentLikeCount[l.comment_id] = (commentLikeCount[l.comment_id] ?? 0) + 1
    if (l.user_id === user.id) commentLikedByMe.add(l.comment_id)
  }

  const commentsByPost: Record<string, { id: string; user_id: string; author_name: string; content: string; created_at: string; likeCount: number; likedByMe: boolean }[]> = {}
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

  const posts = (rawPosts ?? []).map((p) => ({
    ...p,
    author_name: authorName(p.user_id),
    likeCount: likeCountMap[p.id] ?? 0,
    likedByMe: likedByMe.has(p.id),
    comments: commentsByPost[p.id] ?? [],
  }))

  // Next meet and who has said they are coming. The RPC honours frequency and
  // resolves "today" in the circle's own timezone.
  const { data: nextOccurs } = await supabase.rpc('circle_next_occurrence', { cid: id })
  const nextMeet: string | null = nextOccurs ?? null
  const circleToday: string | null = nextMeet
    ? ((await supabase.rpc('circle_today', { cid: id })).data ?? null)
    : null

  const { data: checkInRows } = nextMeet
    ? await supabase
        .from('circle_check_ins')
        .select('user_id, status')
        .eq('circle_id', id)
        .eq('occurs_on', nextMeet)
    : { data: [] as { user_id: string; status: string }[] }

  const checkIns = checkInRows ?? []
  const myCheckIn = checkIns.find((c) => c.user_id === user.id)?.status ?? null
  const statusOf = Object.fromEntries(checkIns.map((c) => [c.user_id, c.status]))
  const going = checkIns.filter((c) => c.status === 'yes')
  const maybes = checkIns.filter((c) => c.status === 'maybe')

  const myName = myProfile?.full_name ?? 'You'

  const isMember = !!membership
  const isAdmin = membership?.role === 'admin'
  const hasPendingRequest = joinRequest?.status === 'pending'
  const totalMembers = memberCount ?? 0
  const hiddenCount = Math.max(0, totalMembers - members.length)

  const window = nextMeet && schedule
    ? checkInWindow(nextMeet, schedule.start_time, schedule.end_time, circle.timezone)
    : { open: false, reason: undefined as string | undefined }

  const membersSorted = [...members].sort((a, b) => {
    const rank = (s?: string) => (s === 'yes' ? 0 : s === 'maybe' ? 1 : s === 'no' ? 3 : 2)
    return rank(statusOf[a.user_id]) - rank(statusOf[b.user_id]) || a.full_name.localeCompare(b.full_name)
  })

  // ---------------------------------------------------------------------
  // Did they show?
  //
  // Two halves. The register for the meet that just finished, so there is
  // something to count, and the ratio beside each name, so "5 going" stops
  // being a number and starts being a claim you can weigh.
  // ---------------------------------------------------------------------
  const { data: lastMeetDate } = await supabase.rpc('circle_last_meet', { cid: id })
  const lastMeet: string | null = lastMeetDate ?? null

  const [{ data: lastCheckIns }, { data: lastAttendance }, { data: reliabilityRows }] = await Promise.all([
    lastMeet
      ? supabase.from('circle_check_ins').select('user_id, status').eq('circle_id', id).eq('occurs_on', lastMeet).eq('status', 'yes')
      : Promise.resolve({ data: [] as { user_id: string; status: string }[] }),
    lastMeet
      ? supabase.from('circle_attendance').select('user_id, attended').eq('circle_id', id).eq('occurs_on', lastMeet)
      : Promise.resolve({ data: [] as { user_id: string; attended: boolean }[] }),
    memberUserIds.length > 0
      ? supabase.rpc('member_stats', { uids: memberUserIds })
      : Promise.resolve({ data: [] as MemberStats[] }),
  ])

  const attendanceMap = Object.fromEntries((lastAttendance ?? []).map((a) => [a.user_id, a.attended]))
  const register = (lastCheckIns ?? []).map((c) => ({
    user_id: c.user_id,
    full_name: profileMap[c.user_id] ?? 'Member',
    attended: (attendanceMap[c.user_id] ?? null) as boolean | null,
  }))
  // Filed means every person who said yes has been accounted for either way.
  const registerFiled = register.length > 0 && register.every((p) => p.attended !== null)

  // Under three confirmed meets a ratio is noise, and an unlucky first week
  // would follow someone around. Below the bar, say nothing.
  const RELIABILITY_MIN = 3
  const rateOf: Record<string, { committed: number; kept: number }> = Object.fromEntries(
    ((reliabilityRows ?? []) as MemberStats[])
      .filter((r) => r.committed >= RELIABILITY_MIN)
      .map((r) => [r.user_id, { committed: r.committed, kept: r.kept }])
  )

  return (
    <>
      <TopNav />
      <div className="pt-14 max-md:pb-[calc(var(--tabbar)+2rem)] md:pb-0 min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-5 md:px-6 py-8 md:py-10 space-y-8">

          {actionError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3.5 py-2.5 rounded-xl">
              {actionError}
            </p>
          )}

          {/* Back + admin links */}
          <div className="flex items-center justify-between">
            <BackButton fallback="/explore" />
            {isAdmin && (
              <div className="flex items-center gap-4 text-sm">
                <Link href={`/circles/${id}/edit`} className="text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border">Edit</Link>
                <Link href={`/circles/${id}/requests`} className="text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border">Requests</Link>
              </div>
            )}
          </div>

          {/* Masthead */}
          <header className="fade-rise pb-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-6 gap-y-4 items-end">
            <div className="space-y-3 min-w-0">
              <p className="text-[15px] text-muted-foreground">
                {[circle.category, isPrivate ? 'private' : 'public', circle.kind === 'commercial' ? 'business' : null]
                  .filter(Boolean).join(', ')}
              </p>
              <h1 className="text-[2.4rem] md:text-[3.25rem]">
                {circle.emoji && <span className="mr-3">{circle.emoji}</span>}{circle.name}
              </h1>
              <p className="text-base text-muted-foreground max-w-prose">
                {schedule ? (
                  <>Meets <b className="font-medium text-foreground">{meetsPhrase(schedule)}</b>{place ? ` at ${place}` : ''}. </>
                ) : (
                  <>No schedule yet{isAdmin ? <>. <Link href={`/circles/${id}/edit`} className="underline underline-offset-4 decoration-1">Set one</Link></> : null}. </>
                )}
                {creatorFirst && <>Started by {creatorFirst}{isOfficial(circle.created_by) && <OfficialBadge />}. </>}
                {totalMembers} member{totalMembers !== 1 ? 's' : ''}.
              </p>
              {circle.description && <p className="text-muted-foreground max-w-prose">{circle.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isAdmin && (
                isMember ? (
                  <form action={leaveCircle}>
                    <input type="hidden" name="circle_id" value={id} />
                    <Button variant="outline" size="sm" type="submit" className="rounded-full">Leave</Button>
                  </form>
                ) : isPrivate ? (
                  hasPendingRequest ? (
                    <form action={withdrawRequest}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button variant="outline" size="sm" type="submit" className="rounded-full">Withdraw request</Button>
                    </form>
                  ) : (
                    <form action={requestToJoin}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button size="sm" type="submit" className="rounded-full">Request to join</Button>
                    </form>
                  )
                ) : (
                  <form action={joinCircle}>
                    <input type="hidden" name="circle_id" value={id} />
                    <Button size="sm" type="submit" className="rounded-full">Join</Button>
                  </form>
                )
              )}
              {isMember && !isAdmin && null}
              <CopyLinkButton />
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-x-10 gap-y-8">
            {/* Left column: next meet, who's coming, notes */}
            <div className="space-y-8 min-w-0">
              {/* The one boxed thing on the page. */}
              {nextMeet && schedule && (
                <div className="rounded-3xl bg-muted p-5 space-y-3 fade-rise">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="text-[26px] tracking-tight">
                      {(() => {
                        const rel = relativeDayLabel(nextMeet, circleToday ?? nextMeet)
                        return rel === 'Today' || rel === 'Tomorrow' ? rel : dayNameISO(nextMeet)
                      })()}
                    </p>
                    <p className="num text-sm text-muted-foreground">
                      {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                      {circle.timezone && <MeetZone tz={circle.timezone} />}
                    </p>
                  </div>
                  <p className={`text-sm font-medium ${window.open ? 'text-pen' : 'text-muted-foreground'}`}>
                    {window.open ? 'Check-in open' : window.reason ?? ''}
                  </p>
                  {isMember ? (
                    <CheckInControl
                      circleId={id}
                      occursOn={nextMeet}
                      initialStatus={myCheckIn as 'yes' | 'no' | 'maybe' | null}
                      disabled={!window.open}
                      disabledReason={undefined}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Join this circle to check in.</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {going.length === 0
                      ? 'Nobody has said yes yet.'
                      : `${going.length} going${maybes.length > 0 ? `, ${maybes.length} maybe` : ''}`}
                  </p>
                </div>
              )}

              {/* The register for the meet that just finished. Members only,
                  and only while there is something to count. */}
              {isMember && lastMeet && register.length > 0 && (
                <div className="fade-rise">
                  <AttendanceRegister
                    circleId={id}
                    occursOn={lastMeet}
                    dateLabel={longDateISO(lastMeet)}
                    people={register}
                    alreadyFiled={registerFiled}
                  />
                </div>
              )}

              {/* Who's coming, then everyone else */}
              {(isMember || !isPrivate) && members.length > 0 && (
                <div className="fade-rise stagger-1">
                  <p className="label mb-2">{nextMeet ? "Who's coming" : 'Members'}</p>
                  <ul className="divide-y divide-border/70 border-t border-border/70">
                    {membersSorted.map((m) => {
                      const st = statusOf[m.user_id]
                      return (
                        <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                          {isOfficial(m.user_id) ? <OfficialAvatar className="w-7 h-7" /> : <Initials name={m.full_name} size="sm" />}
                          <span className="flex-1 min-w-0">
                            <Link
                              href={m.isMe ? '/profile' : `/profile/${m.user_id}`}
                              className="text-sm block truncate hover:underline underline-offset-4 decoration-1"
                            >
                              {m.full_name}{isOfficial(m.user_id) && <OfficialBadge />}
                              {m.role === 'admin' && <span className="font-medium text-muted-foreground ml-2">admin</span>}
                            </Link>
                            {/* The point of the whole register: a yes from
                                somebody who turns up 11 times out of 12 is
                                worth more than a yes from somebody who does
                                not, and until now they looked identical. */}
                            {rateOf[m.user_id] && (
                              <span className="label" title="Meets they said yes to, and turned up for">
                                shows up {rateOf[m.user_id].kept} of {rateOf[m.user_id].committed}
                              </span>
                            )}
                          </span>
                          {nextMeet && st && (
                            <span className={`label ${st === 'yes' ? 'text-pen' : ''}`}>
                              {st === 'yes' ? 'going' : st === 'maybe' ? 'maybe' : "can't"}
                            </span>
                          )}
                          {isAdmin && !m.isMe && (
                            <RoleToggle
                              circleId={id}
                              userId={m.user_id}
                              name={m.full_name}
                              isAdmin={m.role === 'admin'}
                            />
                          )}
                          {!m.isMe && (
                            <FollowButton targetId={m.user_id} circleId={id} initialIsFollowing={m.isFollowing} />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {hiddenCount > 0 && (
                    <p className="label mt-2">+{hiddenCount} more</p>
                  )}
                </div>
              )}

              {/* Notes / gated */}
              {isPrivate && !isMember ? (
                <div className="border border-border p-8 text-center fade-rise">
                  <p className="text-lg font-medium tracking-tight mb-1">This circle is private</p>
                  <p className="text-sm text-muted-foreground">
                    {hasPendingRequest
                      ? 'Your request is pending. The admin will review it soon.'
                      : 'Request to join to see notes and updates.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 fade-rise stagger-2">
                  <p className="label">Notes</p>
                  {isMember && <PostCompose circleId={id} authorName={myName} />}
                  {posts.length === 0 ? (
                    <div className="py-6">
                      <p className="text-lg font-medium tracking-tight">No notes yet.</p>
                      <p className="text-sm text-muted-foreground">{isMember ? 'Leave the first one for the next meet.' : 'Nothing posted here yet.'}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border border-t border-b">
                      {posts.map((post) => (
                        <PostItem
                          key={post.id}
                          post={{
                            id: post.id,
                            circleId: id,
                            content: post.content,
                            created_at: post.created_at,
                            user_id: post.user_id,
                            author_name: post.author_name,
                          }}
                          currentUserId={user.id}
                          currentUserName={myName}
                          initialLikeCount={post.likeCount}
                          initialLiked={post.likedByMe}
                          initialComments={post.comments}
                          canInteract={isMember}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right column: where */}
            <aside className="space-y-6 min-w-0">
              {(exactPoint || area) && (
                <div className="fade-rise stagger-1">
                  <p className="label mb-2">Where</p>
                  {/* Members get the place; everyone else gets an area. The
                      database decides: circle_places() returns nothing to a
                      non-member, so there is no point here to leak. */}
                  <div className="h-56 rounded-2xl overflow-hidden">
                    {exactPoint ? (
                      <CircleLocationMap
                        longitude={exactPoint.longitude}
                        latitude={exactPoint.latitude}
                        emoji={circle.emoji}
                      />
                    ) : (
                      <CircleLocationMap
                        longitude={area!.longitude}
                        latitude={area!.latitude}
                        radiusM={area!.radiusM}
                        emoji={circle.emoji}
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {(circle.neighborhood || exact?.location) && <span>{circle.neighborhood ?? exact?.location}, </span>}
                    <DistanceFromYou
                      latitude={(exactPoint ?? area)!.latitude}
                      longitude={(exactPoint ?? area)!.longitude}
                      initial={fromYou((exactPoint ?? area)!.latitude, (exactPoint ?? area)!.longitude)}
                    />
                    {!exactPoint && <span>{geo ? ', ' : ''}exact spot shown to members</span>}
                  </p>
                </div>
              )}
              {schedule && (
                <div className="fade-rise stagger-2">
                  <p className="label mb-2">When</p>
                  <p className="text-sm text-muted-foreground">
                    {meetsPhrase(schedule)}
                    {schedule.note && <span className="block font-medium text-muted-foreground mt-1">{schedule.note}</span>}
                  </p>
                  {schedules && schedules.length > 1 && (
                    <p className="text-sm text-muted-foreground mt-2">+{schedules.length - 1} more schedule{schedules.length > 2 ? 's' : ''}</p>
                  )}
                </div>
              )}
              {circle.created_by !== user.id && (
                <div className="text-xs">
                  <ReportButton targetType="circle" targetId={id} label="Report this circle" />
                </div>
              )}
            </aside>
          </div>

        </div>
      </div>
    </>
  )
}
