import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import InboxReadMarker from './InboxReadMarker'

const TYPE_TEXT: Record<string, string> = {
  post_like: 'liked your post',
  post_comment: 'commented on your post',
  comment_like: 'liked your comment',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, actor_id, type, circle_id, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const actorIds = [...new Set((notifs ?? []).map((n) => n.actor_id))]
  const { data: actors } = actorIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string }[] }
  const actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, a.full_name]))

  return (
    <>
      <TopNav />
      <InboxReadMarker />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold lowercase mb-6">inbox</h1>

          {!notifs || notifs.length === 0 ? (
            <div className="border-t border-b py-12 text-center">
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-b">
              {notifs.map((n) => {
                const actor = actorMap[n.actor_id] ?? 'Someone'
                const text = TYPE_TEXT[n.type] ?? 'interacted with you'
                const href = n.circle_id ? `/circles/${n.circle_id}` : '/home'
                return (
                  <Link key={n.id} href={href} className={`flex items-center gap-3 py-3.5 ${!n.read ? '' : 'opacity-70'}`}>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initialsOf(actor)}
                    </div>
                    <p className="flex-1 min-w-0 text-sm">
                      <span className="font-medium">{actor}</span> {text}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-foreground flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
