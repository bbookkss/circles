import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { followUser, unfollowUser } from '@/app/actions/follows'
import { Button } from '@/components/ui/button'

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Redirect to own profile
  if (user.id === id) redirect('/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, bio, instagram')
    .eq('id', id)
    .maybeSingle()

  if (!profile) notFound()

  const [
    { data: memberships },
    { count: followerCount },
    { count: followingCount },
    { data: followRow },
    { data: followsMeRow },
    { data: reliability },
    { data: sharedCircleIds },
    { data: mutualMemberIds },
  ] = await Promise.all([
    supabase.from('circle_members').select('circle_id').eq('user_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).maybeSingle(),
    supabase.from('follows').select('follower_id').eq('follower_id', id).eq('following_id', user.id).maybeSingle(),
    supabase.rpc('member_stats', { uids: [id] }),
    // What you two have in common. Both take only the other person and read
    // the viewer from auth.uid(), so neither can be pointed at two strangers.
    supabase.rpc('shared_circles', { p_other: id }),
    supabase.rpc('mutual_members', { p_other: id }),
  ])

  const stats = ((reliability ?? []) as { meets_attended: number; committed: number; kept: number }[])[0]
  const showsUp = stats && stats.committed >= 3 ? stats : null

  const sharedIds = ((sharedCircleIds ?? []) as string[])
  const mutualIds = ((mutualMemberIds ?? []) as string[])
  const [{ data: sharedCircles }, { data: mutuals }] = await Promise.all([
    sharedIds.length > 0
      ? supabase.from('circles').select('id, name, emoji').in('id', sharedIds)
      : Promise.resolve({ data: [] as { id: string; name: string; emoji: string | null }[] }),
    mutualIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', mutualIds).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const circleIds = memberships?.map((m) => m.circle_id) ?? []

  // Only show public circles
  const { data: circles } = circleIds.length > 0
    ? await supabase
        .from('circles')
        .select('id, name, emoji, category, neighborhood, location')
        .in('id', circleIds)
        .eq('visibility', 'public')
    : { data: [] }

  const isFollowing = !!followRow
  // Following someone is enough to message them. Mutual follow was the old
  // rule; pilot users found it and could not work out why Message was
  // missing. The policy in dm-follow-2026-09-13.sql matches this.
  const canMessage = !!followRow
  void followsMeRow

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <TopNav />
      <main className="pt-14 pb-20 md:pb-0 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Avatar + name + bio */}
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl leading-tight">{profile.full_name}</h1>
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 inline-block"
                >
                  @{profile.instagram}
                </a>
              )}
              {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
              <div className="flex items-center gap-2 pt-1">
                <form action={isFollowing ? unfollowUser : followUser}>
                  <input type="hidden" name="following_id" value={id} />
                  <Button type="submit" size="sm" variant={isFollowing ? 'outline' : 'default'}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </form>
                {canMessage && (
                  <Link href={`/messages/${id}`}>
                    <Button size="sm" variant="outline">Message</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <Link href={`/profile/${id}/followers`} className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{followerCount ?? 0}</p>
              <p className="text-muted-foreground">Followers</p>
            </Link>
            <Link href={`/profile/${id}/following`} className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{followingCount ?? 0}</p>
              <p className="text-muted-foreground">Following</p>
            </Link>
            <a href="#circles" className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{circles?.length ?? 0}</p>
              <p className="text-muted-foreground">Circles</p>
            </a>
            <div className="text-center" title="Meets they were confirmed at">
              <p className="font-bold text-lg">{stats?.meets_attended ?? 0}</p>
              <p className="text-muted-foreground">Meets</p>
            </div>
          </div>

          {showsUp && (
            <p className="text-sm">
              <span className="font-display font-semibold text-pen">
                Shows up {showsUp.kept} of {showsUp.committed}
              </span>
              <span className="text-foreground/70"> meets they said yes to.</span>
            </p>
          )}

          {/* What you have in common. The reason a stranger is worth
              meeting is rarely the stranger; it is the person you both
              already know. */}
          {(sharedCircles?.length || mutuals?.length) ? (
            <div className="space-y-1.5">
              <p className="label">In common</p>
              {sharedCircles && sharedCircles.length > 0 && (
                <p className="text-sm text-foreground/80">
                  You are both in{' '}
                  {sharedCircles.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && (i === sharedCircles.length - 1 ? ' and ' : ', ')}
                      <Link href={`/circles/${c.id}`} className="font-display font-semibold hover:underline underline-offset-4 decoration-pen-soft">
                        {c.emoji ? `${c.emoji} ` : ''}{c.name}
                      </Link>
                    </span>
                  ))}
                  .
                </p>
              )}
              {mutuals && mutuals.length > 0 && (
                <p className="text-sm text-foreground/80">
                  You both know{' '}
                  {mutuals.slice(0, 3).map((m, i, shown) => (
                    <span key={m.id}>
                      {i > 0 && (i === shown.length - 1 && mutuals.length <= 3 ? ' and ' : ', ')}
                      <Link href={`/profile/${m.id}`} className="font-semibold hover:underline underline-offset-4 decoration-pen-soft">
                        {m.full_name}
                      </Link>
                    </span>
                  ))}
                  {mutuals.length > 3 && ` and ${mutuals.length - 3} other${mutuals.length - 3 === 1 ? '' : 's'}`}
                  .
                </p>
              )}
            </div>
          ) : null}

          {/* Public circles */}
          <div id="circles" className="space-y-3 scroll-mt-20">
            <p className="label">Circles</p>
            {circles && circles.length > 0 ? (
              <ul className="divide-y divide-border border-t border-b">
                {circles.map((circle) => (
                  <li key={circle.id}>
                    <Link
                      href={`/circles/${circle.id}`}
                      className="flex items-center gap-3 py-3 hover:underline underline-offset-4 decoration-pen-soft"
                    >
                      <span className="text-lg">{circle.emoji ?? '●'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold truncate">{circle.name}</p>
                        {(circle.neighborhood || circle.location) && (
                          <p className="text-xs text-foreground/75 truncate">{circle.neighborhood ?? circle.location}</p>
                        )}
                      </div>
                      {circle.category && (
                        <span className="font-display italic text-sm text-pen">{circle.category}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No public circles.</p>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
