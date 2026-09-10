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
  const { data: profiles } = otherIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', otherIds)
    : { data: [] as { id: string; full_name: string }[] }
  const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold lowercase mb-6">messages</h1>

          {convs.length === 0 ? (
            <div className="border-t border-b py-12 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No messages yet.</p>
              <p className="text-xs text-muted-foreground">You can DM people who follow you back.</p>
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-b">
              {convs.map((c) => {
                const name = nameMap[c.otherId] ?? 'Someone'
                return (
                  <Link key={c.otherId} href={`/messages/${c.otherId}`} className="flex items-center gap-3 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initialsOf(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'}`}>{name}</p>
                      <p className={`text-xs truncate ${c.unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {c.lastFromMe ? 'You: ' : ''}{c.lastContent}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(c.lastAt)}</span>
                    {c.unread > 0 && <span className="w-2 h-2 rounded-full bg-foreground flex-shrink-0" />}
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
