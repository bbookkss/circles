import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString()
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: msgs } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, content, created_at, read')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(300)

  // Group into conversations by the other participant (msgs are newest-first)
  const convMap = new Map<string, { otherId: string; lastContent: string; lastAt: string; lastFromMe: boolean; unread: number }>()
  for (const m of msgs ?? []) {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id
    if (!convMap.has(otherId)) {
      convMap.set(otherId, {
        otherId,
        lastContent: m.content,
        lastAt: m.created_at,
        lastFromMe: m.sender_id === user.id,
        unread: 0,
      })
    }
    if (m.recipient_id === user.id && !m.read) convMap.get(otherId)!.unread += 1
  }
  const convs = [...convMap.values()]

  const otherIds = convs.map((c) => c.otherId)

  // People you follow are the people you can message. Fetched here so the
  // page can offer a "start a conversation" list instead of a dead end: the
  // only way to open a thread before this was to find the person's profile
  // and hope the Message button was there.
  const { data: followRows } = await supabase
    .from('follows').select('following_id').eq('follower_id', user.id)
  const followingIds = (followRows ?? []).map((f) => f.following_id)
  const startable = followingIds.filter((fid) => !convMap.has(fid))

  const profileIds = [...new Set([...otherIds, ...followingIds])]
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
    : { data: [] as { id: string; full_name: string }[] }
  const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
      <TopNav />
      <main className="pt-14 pb-28 md:pb-12 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 md:px-6 pt-10 space-y-12">
          <section>
            <h1 className="text-[2.4rem] md:text-5xl mb-8">Messages</h1>

            {convs.length === 0 ? (
              <div className="rounded-3xl bg-muted px-6 py-10 space-y-2">
                <p className="text-lg">No messages yet.</p>
                <p className="text-sm text-muted-foreground">
                  {startable.length > 0
                    ? 'Start one with someone you follow, below.'
                    : 'Follow someone to message them.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {convs.map((c) => {
                  const name = nameMap[c.otherId] ?? 'Someone'
                  const isUnread = c.unread > 0
                  return (
                    <li key={c.otherId}>
                      <Link href={`/messages/${c.otherId}`} className="flex items-center gap-4 py-4 group">
                        <div className="w-11 h-11 rounded-full bg-cool-2 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {initialsOf(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3">
                            <p className={`truncate group-hover:underline underline-offset-4 decoration-1 ${isUnread ? 'font-semibold' : 'font-medium'}`}>{name}</p>
                            <span className="ml-auto text-sm text-muted-foreground flex-shrink-0">{timeAgo(c.lastAt)}</span>
                          </div>
                          <p className={`text-[0.95rem] truncate mt-0.5 ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {c.lastFromMe ? 'You: ' : ''}{c.lastContent}
                          </p>
                        </div>
                        {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-heat flex-shrink-0" aria-label={`${c.unread} unread`} />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {startable.length > 0 && (
            <section>
              <h2 className="label mb-3">Start a conversation</h2>
              <ul className="divide-y divide-border border-y border-border">
                {startable.map((fid) => {
                  const name = nameMap[fid] ?? 'Someone'
                  return (
                    <li key={fid} className="flex items-center gap-4 py-3.5">
                      <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {initialsOf(name)}
                      </div>
                      <p className="flex-1 min-w-0 font-medium truncate">{name}</p>
                      <Link
                        href={`/messages/${fid}`}
                        className="text-sm font-medium rounded-full bg-muted px-4 py-2 hover:bg-cool-2 transition-colors"
                      >
                        Message
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
