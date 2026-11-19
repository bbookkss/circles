import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import BottomNav from '@/components/BottomNav'
import FeedbackButton from '@/components/FeedbackButton'
import AskCircles from '@/components/AskCirclesLoader'

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
    {user && <AskCircles />}
    {user && <BottomNav unread={unread ?? 0} unreadDms={unreadDms ?? 0} />}
    {/* A glass pill floating over the page, which scrolls under it. The outer
        bar is transparent and lets clicks through around the pill. */}
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 px-3 pt-2 pointer-events-none">
      <div className="glass pointer-events-auto mx-auto max-w-3xl h-12 rounded-full flex items-center gap-1 pl-4 pr-1.5">
        <Link href="/home" className="flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight mr-3 hover:opacity-75 transition-opacity">
          <Logo />
          Circles
        </Link>

        <div className="hidden md:flex items-center gap-1 flex-1 text-[0.95rem]">
          <Link href="/home" className="px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link href="/explore" className="px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors">Explore</Link>
          <Link href="/messages" className="relative px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors">
            Messages
            {unreadDms ? <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-heat" aria-label={`${unreadDms} unread`} /> : null}
          </Link>
          <Link href="/circles/new" className="px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">Start a circle</Link>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/notifications"
            aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
            className="relative hidden md:grid w-9 h-9 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
            </svg>
            {unread ? <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-heat" /> : null}
          </Link>
          <form action={logout} className="hidden md:block">
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Sign out</button>
          </form>
          <Link
            href="/profile"
            title="Your profile"
            className="w-9 h-9 rounded-full bg-foreground text-background grid place-items-center text-xs font-medium hover:opacity-85 transition-opacity"
          >
            {initials}
          </Link>
        </div>
      </div>
    </nav>
    </>
  )
}
