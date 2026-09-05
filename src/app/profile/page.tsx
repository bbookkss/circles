import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditProfileForm from './EditProfileForm'
import BackfillButton from './BackfillButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, bio')
    .eq('id', user.id)
    .maybeSingle()

  const [
    { data: memberships },
    { count: followerCount },
    { count: followingCount },
  ] = await Promise.all([
    supabase.from('circle_members').select('circle_id, role').eq('user_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
  ])

  const circleIds = memberships?.map((m) => m.circle_id) ?? []
  const { data: circles } = circleIds.length > 0
    ? await supabase.from('circles').select('id, name, emoji, category, visibility').in('id', circleIds)
    : { data: [] }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          {/* Avatar + name + bio */}
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold text-xl">{profile?.full_name ?? 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <EditProfileForm fullName={profile?.full_name ?? ''} bio={profile?.bio ?? null} />
            </div>
          </div>

          {/* Follower / following counts */}
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

          {/* Circles */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Your circles</p>
            {circles && circles.length > 0 ? (
              <ul className="space-y-2">
                {circles.map((circle) => {
                  const role = memberships?.find((m) => m.circle_id === circle.id)?.role
                  return (
                    <li key={circle.id}>
                      <Link
                        href={`/circles/${circle.id}`}
                        className="flex items-center gap-3 border rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                      >
                        <span className="text-lg">{circle.emoji ?? '●'}</span>
                        <span className="flex-1 text-sm font-medium">{circle.name}</span>
                        {circle.visibility === 'private' && <span className="text-xs text-muted-foreground">🔒</span>}
                        {role === 'admin' && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Admin</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No circles yet.</p>
            )}
          </div>

          {/* Dev tools */}
          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tools</p>
            <BackfillButton />
          </div>

        </div>
      </main>
    </>
  )
}
