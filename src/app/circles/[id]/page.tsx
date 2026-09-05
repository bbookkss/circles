import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { joinCircle, leaveCircle, requestToJoin, withdrawRequest } from '@/app/actions/circles'
import TopNav from '@/components/TopNav'
import PostCompose from '@/components/PostCompose'
import PostItem from '@/components/PostItem'
import CopyLinkButton from '@/components/CopyLinkButton'
import FollowButton from '@/components/FollowButton'
import Circled from '@/components/Circled'
import BackButton from '@/components/BackButton'
import CircleLocationMap from '@/components/map/CircleLocationMap'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every other week',
  monthly: 'Monthly',
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function Initials({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={`rounded-full bg-muted flex items-center justify-center font-semibold flex-shrink-0 ${size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'}`}>
      {initials}
    </div>
  )
}

export default async function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: circle } = await supabase
    .from('circles')
    .select('*')
    .eq('id', id)
    .single()

  if (!circle) notFound()

  const isPrivate = circle.visibility === 'private'

  // Data available to everyone
  const [{ count: memberCount }, { data: schedules }] = await Promise.all([
    supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', id),
    supabase.from('circle_schedules').select('*').eq('circle_id', id),
  ])

  const { data: creator } = await supabase
    .from('profiles').select('full_name').eq('id', circle.created_by).maybeSingle()

  // Unauthenticated — show preview card
  if (!user) {
    return (
      <>
        <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-md border-b flex items-center px-4">
          <Link href="/login" className="font-bold text-lg lowercase tracking-tight">circles</Link>
        </nav>
        <div className="pt-14 min-h-screen bg-background">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

            {/* Circle preview */}
            <div className="space-y-4 fade-rise">
              {circle.emoji && <div className="text-6xl">{circle.emoji}</div>}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {isPrivate && <span className="text-xs border px-2 py-0.5 rounded-full text-muted-foreground">Private</span>}
                  {circle.category && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{circle.category}</span>}
                </div>
                <h1 className="text-3xl font-bold">{circle.name}</h1>
                {circle.description && <p className="text-muted-foreground">{circle.description}</p>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {(circle.neighborhood || circle.location) && <span>{circle.neighborhood ?? circle.location}</span>}
                <span>{memberCount ?? 0} member{memberCount !== 1 ? 's' : ''}</span>
                {creator?.full_name && <span>Started by {creator.full_name}</span>}
              </div>
            </div>

            {/* Schedule */}
            {schedules && schedules.length > 0 && (
              <div className="border rounded-xl p-4 space-y-2 bg-card fade-rise stagger-1">
                <p className="text-sm font-semibold">Schedule</p>
                {schedules.map((s) => (
                  <div key={s.id} className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">
                      {(s.days_of_week as number[]).sort().map((d) => DAY_NAMES[d]).join(', ')}
                    </span>
                    {' · '}{formatTime(s.start_time)} – {formatTime(s.end_time)}
                    {' · '}{FREQ_LABELS[s.frequency] ?? s.frequency}
                    {s.note && <span className="block text-xs mt-0.5 italic">{s.note}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Location map */}
            {circle.latitude != null && circle.longitude != null && (
              <div className="fade-rise stagger-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Location</p>
                <div className="h-56 rounded-xl overflow-hidden border">
                  <CircleLocationMap longitude={circle.longitude} latitude={circle.latitude} emoji={circle.emoji} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {(circle.neighborhood || circle.location) && <span>{circle.neighborhood ?? circle.location}</span>}
                  <span className="flex items-center gap-3">
                    <span>Directions:</span>
                    <a href={`https://maps.apple.com/?daddr=${circle.latitude},${circle.longitude}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Apple Maps</a>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${circle.latitude},${circle.longitude}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Google Maps</a>
                  </span>
                </div>
              </div>
            )}

            {/* Join CTA */}
            <div className="border rounded-xl p-6 space-y-4 bg-card fade-rise stagger-2">
              <div>
                <p className="font-semibold text-base">
                  {isPrivate ? 'Want to join this circle?' : 'Join this circle'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPrivate
                    ? 'Create an account to request access. The admin will approve you.'
                    : 'Create a free account to join and see posts from this circle.'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/signup`}>
                  <Button>{isPrivate ? 'Create account to request' : 'Create account to join'}</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline">Sign in</Button>
                </Link>
              </div>
            </div>

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
  const allProfileIds = [...new Set([...memberUserIds, ...postAuthorIds, ...commentAuthorIds, circle.created_by])]

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
      author_name: profileMap[c.user_id] ?? 'Someone',
      content: c.content,
      created_at: c.created_at,
      likeCount: commentLikeCount[c.id] ?? 0,
      likedByMe: commentLikedByMe.has(c.id),
    })
  }

  const posts = (rawPosts ?? []).map((p) => ({
    ...p,
    author_name: profileMap[p.user_id] ?? 'Someone',
    likeCount: likeCountMap[p.id] ?? 0,
    likedByMe: likedByMe.has(p.id),
    comments: commentsByPost[p.id] ?? [],
  }))

  const creatorName = profileMap[circle.created_by] ?? null
  const myName = myProfile?.full_name ?? 'You'

  const isMember = !!membership
  const isAdmin = membership?.role === 'admin'
  const hasPendingRequest = joinRequest?.status === 'pending'
  const totalMembers = memberCount ?? 0
  const hiddenCount = Math.max(0, totalMembers - members.length)

  return (
    <>
      <TopNav />
      <div className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Back + admin links */}
          <div className="flex items-center justify-between">
            <BackButton fallback="/explore" />
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Circled>
                  <Link href={`/circles/${id}/edit`} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1">Edit</Link>
                </Circled>
                <Circled>
                  <Link href={`/circles/${id}/requests`} className="text-sm text-muted-foreground hover:text-foreground px-2 py-1">Requests</Link>
                </Circled>
              </div>
            )}
          </div>

          {/* Header */}
          <div className="space-y-4 fade-rise">
            {circle.emoji && <div className="text-6xl">{circle.emoji}</div>}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {isPrivate && <span className="text-xs border px-2 py-0.5 rounded-full text-muted-foreground">Private</span>}
                {circle.category && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{circle.category}</span>}
              </div>
              <h1 className="text-3xl font-bold">{circle.name}</h1>
              {circle.description && <p className="text-muted-foreground">{circle.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(circle.neighborhood || circle.location) && <span>{circle.neighborhood ?? circle.location}</span>}
              <span>{totalMembers} member{totalMembers !== 1 ? 's' : ''}</span>
              {creatorName && <span>Started by {creatorName}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isAdmin && (
                isMember ? (
                  <form action={leaveCircle}>
                    <input type="hidden" name="circle_id" value={id} />
                    <Button variant="outline" size="sm" type="submit">Leave</Button>
                  </form>
                ) : isPrivate ? (
                  hasPendingRequest ? (
                    <form action={withdrawRequest}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button variant="outline" size="sm" type="submit">Withdraw request</Button>
                    </form>
                  ) : (
                    <form action={requestToJoin}>
                      <input type="hidden" name="circle_id" value={id} />
                      <Button size="sm" type="submit">Request to join</Button>
                    </form>
                  )
                ) : (
                  <form action={joinCircle}>
                    <input type="hidden" name="circle_id" value={id} />
                    <Button size="sm" type="submit">Join</Button>
                  </form>
                )
              )}
              <CopyLinkButton />
            </div>
          </div>

          {/* Schedule */}
          {schedules && schedules.length > 0 && (
            <div className="border rounded-xl p-4 space-y-2 bg-card fade-rise stagger-1">
              <p className="text-sm font-semibold">Schedule</p>
              {schedules.map((s) => (
                <div key={s.id} className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {(s.days_of_week as number[]).sort().map((d) => DAY_NAMES[d]).join(', ')}
                  </span>
                  {' · '}{formatTime(s.start_time)} – {formatTime(s.end_time)}
                  {' · '}{FREQ_LABELS[s.frequency] ?? s.frequency}
                  {s.note && <span className="block text-xs mt-0.5 italic">{s.note}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Location map */}
          {circle.latitude != null && circle.longitude != null && (
            <div className="fade-rise stagger-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Location</p>
              <div className="h-56 rounded-xl overflow-hidden border">
                <CircleLocationMap longitude={circle.longitude} latitude={circle.latitude} emoji={circle.emoji} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                {(circle.neighborhood || circle.location) && <span>{circle.neighborhood ?? circle.location}</span>}
                <span className="flex items-center gap-3">
                  <span>Directions:</span>
                  <a href={`https://maps.apple.com/?daddr=${circle.latitude},${circle.longitude}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Apple Maps</a>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${circle.latitude},${circle.longitude}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Google Maps</a>
                </span>
              </div>
            </div>
          )}

          {/* Members */}
          {(isMember || !isPrivate) && members.length > 0 && (
            <div className="space-y-3 fade-rise stagger-2">
              <p className="text-sm font-semibold">Members</p>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <Initials name={m.full_name} size="sm" />
                    <Link
                      href={m.isMe ? '/profile' : `/profile/${m.user_id}`}
                      className="text-sm flex-1 hover:underline"
                    >
                      {m.full_name}
                    </Link>
                    {m.role === 'admin' && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Admin</span>
                    )}
                    {!m.isMe && (
                      <FollowButton targetId={m.user_id} circleId={id} initialIsFollowing={m.isFollowing} />
                    )}
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <p className="text-xs text-muted-foreground pl-10">+{hiddenCount} more</p>
                )}
              </div>
            </div>
          )}

          {/* Posts / gated */}
          {isPrivate && !isMember ? (
            <div className="border rounded-xl p-8 text-center text-muted-foreground bg-card fade-rise">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium mb-1">This circle is private</p>
              <p className="text-sm">
                {hasPendingRequest
                  ? 'Your request is pending. The admin will review it soon.'
                  : 'Request to join to see posts and updates.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6 fade-rise stagger-3">
              <p className="text-sm font-semibold">Posts</p>
              {isMember && <PostCompose circleId={id} authorName={myName} />}
              {posts.length === 0 ? (
                <div className="border rounded-xl p-8 text-center text-muted-foreground bg-card">
                  <p className="font-medium mb-1">No posts yet</p>
                  <p className="text-sm">{isMember ? 'Be the first to post something.' : 'Nothing posted here yet.'}</p>
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
      </div>
    </>
  )
}
