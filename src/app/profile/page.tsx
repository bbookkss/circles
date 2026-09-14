import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditProfileForm from './EditProfileForm'
import DeleteAccountForm from './DeleteAccountForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, bio, instagram, username, email_reminders')
    .eq('id', user.id)
    .maybeSingle()

  const [
    { data: memberships },
    { count: followerCount },
    { count: followingCount },
    { data: reliability },
  ] = await Promise.all([
    supabase.from('circle_members').select('circle_id, role').eq('user_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    // Aggregate only, and deliberately so: two integers say how reliable
    // somebody is without saying which circles they go to.
    supabase.rpc('reliability', { uids: [user.id] }),
  ])

  // Under three confirmed meets a ratio is noise and an unlucky first week
  // would follow someone around. Below the bar, say nothing.
  const rel = ((reliability ?? []) as { committed: number; attended: number }[])[0]
  const showsUp = rel && rel.committed >= 3 ? rel : null

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
              <h1 className="text-2xl leading-tight">{profile?.full_name ?? 'Unknown'}</h1>
              <p className="label normal-case tracking-normal">{user.email}</p>
              {profile?.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 inline-block"
                >
                  @{profile.instagram}
                </a>
              )}
              <EditProfileForm fullName={profile?.full_name ?? ''} bio={profile?.bio ?? null} instagram={profile?.instagram ?? null} username={profile?.username ?? null} emailReminders={profile?.email_reminders ?? false} />
            </div>
          </div>

          {/* Follower / following counts. Links, because a number you cannot
              open is a number you have to take on faith. */}
          <div className="flex gap-6 text-sm">
            <Link href={`/profile/${user.id}/followers`} className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{followerCount ?? 0}</p>
              <p className="text-muted-foreground">Followers</p>
            </Link>
            <Link href={`/profile/${user.id}/following`} className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{followingCount ?? 0}</p>
              <p className="text-muted-foreground">Following</p>
            </Link>
            <a href="#circles" className="text-center hover:underline underline-offset-4">
              <p className="font-bold text-lg">{circles?.length ?? 0}</p>
              <p className="text-muted-foreground">Circles</p>
            </a>
          </div>

          {showsUp && (
            <p className="text-sm">
              <span className="font-display font-semibold text-pen">
                Shows up {showsUp.attended} of {showsUp.committed}
              </span>
              <span className="text-foreground/70"> meets you said yes to.</span>
            </p>
          )}

          {/* Circles */}
          <div id="circles" className="space-y-3 scroll-mt-20">
            <p className="label">Your circles</p>
            {circles && circles.length > 0 ? (
              <ul className="divide-y divide-border border-t border-b">
                {circles.map((circle) => {
                  const role = memberships?.find((m) => m.circle_id === circle.id)?.role
                  return (
                    <li key={circle.id}>
                      <Link
                        href={`/circles/${circle.id}`}
                        className="flex items-center gap-3 py-3 hover:underline underline-offset-4 decoration-pen-soft"
                      >
                        <span className="text-lg">{circle.emoji ?? '●'}</span>
                        <span className="flex-1 font-display font-semibold">{circle.name}</span>
                        {circle.visibility === 'private' && <span className="font-display italic text-sm text-muted-foreground">private</span>}
                        {role === 'admin' && <span className="font-display italic text-sm text-muted-foreground">admin</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No circles yet.</p>
            )}
          </div>

          {/* Business */}
          <div className="pt-4 border-t space-y-2">
            <p className="label">Business</p>
            <Link href="/business" className="text-sm underline underline-offset-2">
              Run a restaurant or business?
            </Link>
          </div>

          {/* Danger zone */}
          <div className="pt-4 border-t space-y-2">
            <p className="label">Account</p>
            <DeleteAccountForm />
          </div>

        </div>
      </main>
    </>
  )
}
