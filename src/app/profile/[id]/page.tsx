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
    .select('id, full_name, bio')
    .eq('id', id)
    .maybeSingle()

  if (!profile) notFound()

  const [
    { data: memberships },
    { count: followerCount },
    { count: followingCount },
    { data: followRow },
  ] = await Promise.all([
    supabase.from('circle_members').select('circle_id').eq('user_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).maybeSingle(),
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

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Avatar + name + bio */}
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-bold text-xl">{profile.full_name}</p>
              {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
              <form action={isFollowing ? unfollowUser : followUser}>
                <input type="hidden" name="following_id" value={id} />
                <Button type="submit" size="sm" variant={isFollowing ? 'outline' : 'default'}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </form>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-lg">{followerCount ?? 0}</p>
              <p className="text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{followingCount ?? 0}</p>
              <p className="text-muted-foreground">Following</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{circles?.length ?? 0}</p>
              <p className="text-muted-foreground">Circles</p>
            </div>
          </div>

          {/* Public circles */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Circles</p>
            {circles && circles.length > 0 ? (
              <ul className="space-y-2">
                {circles.map((circle) => (
                  <li key={circle.id}>
                    <Link
                      href={`/circles/${circle.id}`}
                      className="flex items-center gap-3 border rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                    >
                      <span className="text-lg">{circle.emoji ?? '●'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{circle.name}</p>
                        {(circle.neighborhood || circle.location) && (
                          <p className="text-xs text-muted-foreground">📍 {circle.neighborhood ?? circle.location}</p>
                        )}
                      </div>
                      {circle.category && (
                        <span className="text-xs text-muted-foreground">{circle.category}</span>
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
