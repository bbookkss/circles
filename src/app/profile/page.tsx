import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditProfileForm from './EditProfileForm'
import DeleteAccountForm from './DeleteAccountForm'
import FeedbackButton from '@/components/FeedbackButton'
import NotificationsSwitch from '@/components/NotificationsSwitch'
import { logout } from '@/app/actions/auth'
import { unblockUser } from '@/app/actions/safety'

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
    { data: blockRows },
  ] = await Promise.all([
    supabase.from('circle_members').select('circle_id, role').eq('user_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    // Aggregate only, and deliberately so: two integers say how reliable
    // somebody is without saying which circles they go to.
    supabase.rpc('member_stats', { uids: [user.id] }),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id).order('created_at', { ascending: false }),
  ])

  // Under three confirmed meets a ratio is noise and an unlucky first week
  // would follow someone around. Below the bar, say nothing.
  const stats = ((reliability ?? []) as { meets_attended: number; committed: number; kept: number }[])[0]
  const showsUp = stats && stats.committed >= 3 ? stats : null

  const circleIds = memberships?.map((m) => m.circle_id) ?? []
  const { data: circles } = circleIds.length > 0
    ? await supabase.from('circles').select('id, name, emoji, category, visibility').in('id', circleIds)
    : { data: [] }

  // Blocked people vanish from feeds and messages, so this list is the one
  // place left to find them again.
  const blockedIds = (blockRows ?? []).map((b) => b.blocked_id)
  const { data: blockedProfiles } = blockedIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', blockedIds)
    : { data: [] as { id: string; full_name: string | null }[] }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <TopNav />
      <main className="pt-14 max-md:pb-[calc(var(--tabbar)+2rem)] md:pb-12 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 md:px-6 pt-10 space-y-10">

          {/* Avatar + name + bio */}
          <div className="flex items-start gap-5">
            <div className="w-[72px] h-[72px] rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-normal flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h1 className="text-[2.2rem] md:text-[2.6rem]">{profile?.full_name ?? 'Unknown'}</h1>
              <p className="text-sm text-muted-foreground pt-1">{user.email}</p>
              {profile?.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-1 inline-block"
                >
                  @{profile.instagram}
                </a>
              )}
              <EditProfileForm fullName={profile?.full_name ?? ''} bio={profile?.bio ?? null} instagram={profile?.instagram ?? null} username={profile?.username ?? null} emailReminders={profile?.email_reminders ?? false} />
            </div>
          </div>

          {/* Follower / following counts. Links, because a number you cannot
              open is a number you have to take on faith. */}
          <div className="grid grid-cols-4 gap-2 rounded-3xl bg-muted p-2 text-sm">
            <Link href={`/profile/${user.id}/followers`} className="text-center rounded-2xl py-3 hover:bg-background/60 transition-colors">
              <p className="text-2xl font-light tracking-tight">{followerCount ?? 0}</p>
              <p className="text-muted-foreground">Followers</p>
            </Link>
            <Link href={`/profile/${user.id}/following`} className="text-center rounded-2xl py-3 hover:bg-background/60 transition-colors">
              <p className="text-2xl font-light tracking-tight">{followingCount ?? 0}</p>
              <p className="text-muted-foreground">Following</p>
            </Link>
            <a href="#circles" className="text-center rounded-2xl py-3 hover:bg-background/60 transition-colors">
              <p className="text-2xl font-light tracking-tight">{circles?.length ?? 0}</p>
              <p className="text-muted-foreground">Circles</p>
            </a>
            {/* Times you came back, which is the number this product is
                actually about. Counts every meet you were confirmed at,
                including ones you never said yes to and turned up anyway. */}
            <div className="text-center rounded-2xl py-3" title="Meets you were confirmed at">
              <p className="text-2xl font-light tracking-tight">{stats?.meets_attended ?? 0}</p>
              <p className="text-muted-foreground">Meets</p>
            </div>
          </div>

          {showsUp && (
            <p className="text-[0.95rem]">
              <span className="font-medium">Shows up {showsUp.kept} of {showsUp.committed}</span>
              <span className="text-muted-foreground"> meets you said yes to.</span>
            </p>
          )}

          {/* Circles */}
          <div id="circles" className="space-y-3 scroll-mt-20">
            <h2 className="label">Your circles</h2>
            {circles && circles.length > 0 ? (
              <ul className="divide-y divide-border border-y border-border">
                {circles.map((circle) => {
                  const role = memberships?.find((m) => m.circle_id === circle.id)?.role
                  return (
                    <li key={circle.id}>
                      <Link
                        href={`/circles/${circle.id}`}
                        className="flex items-center gap-3 py-3.5 group"
                      >
                        <span className="text-lg">{circle.emoji ?? '●'}</span>
                        <span className="flex-1 font-medium group-hover:underline underline-offset-4 decoration-1">{circle.name}</span>
                        {circle.visibility === 'private' && <span className="text-xs rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Private</span>}
                        {role === 'admin' && <span className="text-xs rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Admin</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No circles yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="label">Notifications</h2>
            <NotificationsSwitch />
          </div>

          {/* On phones the feedback form lives here, not in a floating button. */}
          <div className="md:hidden space-y-3">
            <h2 className="label">Feedback</h2>
            <p className="text-sm text-muted-foreground">A bug, something confusing, something you wish it did. It goes straight to Ben.</p>
            <FeedbackButton inline />
          </div>

          {blockedProfiles && blockedProfiles.length > 0 && (
            <div className="space-y-3">
              <h2 className="label">Blocked</h2>
              <ul className="divide-y divide-border border-y border-border">
                {blockedProfiles.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <span className="flex-1">{b.full_name ?? 'Someone'}</span>
                    <form action={unblockUser}>
                      <input type="hidden" name="user_id" value={b.id} />
                      <button type="submit" className="text-sm font-medium rounded-full bg-muted px-4 py-2 hover:bg-cool-2 transition-colors">
                        Unblock
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Business */}
          <div className="space-y-2">
            <h2 className="label">Business</h2>
            <Link href="/business" className="underline underline-offset-4 decoration-1 decoration-cool-2 hover:decoration-foreground">
              Run a restaurant or business?
            </Link>
          </div>

          {/* Danger zone */}
          <div className="space-y-3 pt-6 border-t border-border">
            <h2 className="label">Account</h2>
            {/* Sign out lived behind the phone hamburger, which is gone. The
                account page is where people look for it anyway. */}
            <form action={logout}>
              <button
                type="submit"
                className="min-h-11 px-5 rounded-full bg-muted text-sm font-medium hover:bg-cool-2 transition-colors"
              >
                Sign out
              </button>
            </form>
            <div className="pt-2">
              <DeleteAccountForm />
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
