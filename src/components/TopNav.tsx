import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import Circled from '@/components/Circled'
import BottomNav from '@/components/BottomNav'
import FeedbackButton from '@/components/FeedbackButton'

export default async function TopNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    : { data: null }

  const [{ count: unread }, { count: unreadDms }] = user
    ? await Promise.all([
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('read', false),
      ])
    : [{ count: 0 }, { count: 0 }]

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
    {/* Outside the nav on purpose. The bar's backdrop-blur makes it the
        containing block for anything position:fixed inside it, so a button
        that asked for "bottom right of the screen" got the bottom right of
        the bar instead and sat on top of Sign out. As a sibling it pins to
        the viewport. Every signed-in page carries this component, so it is
        still the one place for a control that should be everywhere. */}
    {user && <FeedbackButton />}
    {user && <BottomNav unread={unread ?? 0} unreadDms={unreadDms ?? 0} />}
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-md border-b flex items-center px-4 gap-4">
      {/* Logo */}
      <Link href="/home" className="font-display font-semibold text-[1.35rem] mr-2 tracking-tight hover:opacity-70 transition-opacity">
        circles
      </Link>

      {/* Center links */}
      <div className="hidden md:flex items-center gap-2 flex-1">
        <Circled>
          <Link href="/home" className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
        </Circled>
        <Circled>
          <Link href="/explore" className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Explore</Link>
        </Circled>
        <Circled>
          <Link href="/circles/new" className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">+ New Circle</Link>
        </Circled>
      </div>

      {/* Right: notifications + profile + sign out */}
      <div className="hidden md:flex items-center gap-3">
        <Circled>
          <Link href="/messages" className="relative px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Messages
            {unreadDms ? (
              <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {unreadDms > 9 ? '9+' : unreadDms}
              </span>
            ) : null}
          </Link>
        </Circled>
        <Circled>
          <Link href="/notifications" className="relative px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Notifications
            {unread ? (
              <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
        </Circled>
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
          title="Your profile"
        >
          {initials}
        </Link>
        <Circled>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Sign out
            </button>
          </form>
        </Circled>
      </div>

      {/* Phones: the account stays up here, which is where people look for
          it, and everything else moved to the bottom bar. The hamburger is
          gone. A 44px target rather than the 32px avatar the desktop row
          uses, since this is now the only thing to hit up here. */}
      <Link
        href="/profile"
        className="md:hidden ml-auto w-11 h-11 -mr-1.5 flex items-center justify-center"
        title="Your profile"
      >
        <span className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
          {initials}
        </span>
      </Link>
    </nav>
    </>
  )
}
