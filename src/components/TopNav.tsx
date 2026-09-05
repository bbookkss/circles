import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

export default async function TopNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    : { data: null }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b flex items-center px-4 gap-4">
      {/* Logo */}
      <Link href="/dashboard" className="font-bold text-lg mr-2">
        Circles
      </Link>

      {/* Center links */}
      <div className="flex items-center gap-1 flex-1">
        <Link
          href="/explore"
          className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          🗺 Explore
        </Link>
        <Link
          href="/circles/new"
          className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          + New Circle
        </Link>
      </div>

      {/* Right: profile + sign out */}
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
          title="Your profile"
        >
          {initials}
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
