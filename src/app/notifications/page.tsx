import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ReadMarker from './ReadMarker'

const TYPE_TEXT: Record<string, string> = {
  post_like: 'liked your post',
  post_comment: 'commented on your post',
  comment_like: 'liked your comment',
  join_request: 'requested to join your circle',
  request_approved: 'approved your request to join',
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

export default async function NotificationsPage() {
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
      <ReadMarker />
      <main className="pt-14 pb-28 md:pb-12 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 md:px-6 pt-10">
          <h1 className="text-[2.4rem] md:text-5xl mb-8">Notifications</h1>

          {!notifs || notifs.length === 0 ? (
            <div className="rounded-3xl bg-muted px-6 py-10 space-y-2">
              <p className="text-lg">Nothing yet.</p>
              <p className="text-sm text-muted-foreground">When someone joins your circle, likes your note or follows you, it shows up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {notifs.map((n) => {
                const actor = actorMap[n.actor_id] ?? 'Someone'
                const text = TYPE_TEXT[n.type] ?? 'interacted with you'
                const href = n.type === 'join_request' && n.circle_id
                  ? `/circles/${n.circle_id}/requests`
                  : n.circle_id ? `/circles/${n.circle_id}` : '/home'
                return (
                  <li key={n.id}>
                    <Link href={href} className="flex items-center gap-4 py-4 group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${!n.read ? 'bg-cool-2' : 'bg-muted text-muted-foreground'}`}>
                        {initialsOf(actor)}
                      </div>
                      <p className={`flex-1 min-w-0 text-[0.95rem] ${!n.read ? '' : 'text-muted-foreground'}`}>
                        <span className={`font-medium ${!n.read ? '' : 'text-foreground/80'} group-hover:underline underline-offset-4 decoration-1`}>{actor}</span> {text}
                      </p>
                      <span className="text-sm text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                      {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-heat flex-shrink-0" aria-label="New" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  )
}
