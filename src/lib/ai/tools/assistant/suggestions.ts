import 'server-only'
import type { Ctx } from './types'

/**
 * Suggested prompts, worked out from the person's own week and inbox.
 * No model call: this costs nothing and runs every time the panel opens.
 */
export async function suggestionsFor(ctx: Ctx): Promise<string[]> {
  const [week, unreadRes] = await Promise.all([
    ctx.week(),
    ctx.supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', ctx.userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const out: string[] = []
  const day = (label: string) => (label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : `on ${label}`)

  const unanswered = week.find((m) => m.open && !m.my_status && !m.scheduled_status)
  if (unanswered) out.push(`Am I going to ${unanswered.circle_name} ${day(unanswered.day_label)}?`)

  const unread = unreadRes.data ?? []
  const senders = [...new Set(unread.map((m) => m.sender_id as string))]
  if (senders.length === 1) {
    const { data } = await ctx.supabase.from('profiles').select('full_name').eq('id', senders[0]).maybeSingle()
    const first = ((data?.full_name as string | null) ?? '').split(' ')[0]
    out.push(first ? `Read ${first}'s message` : 'Read my new message')
  } else if (unread.length > 1) {
    out.push(`Read my ${unread.length} new messages`)
  }

  const later = week.find((m) => m !== unanswered && !m.my_status)
  if (later) out.push(`Who's going to ${later.circle_name}?`)

  if (week.length > 0) out.push("What's on this week?")

  // The first day in the next week with nothing on.
  const busy = new Set(week.map((m) => m.occurs_on))
  for (let i = 1; i <= 7 && out.length < 4; i++) {
    const d = new Date(`${ctx.today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    const iso = d.toISOString().slice(0, 10)
    if (!busy.has(iso)) {
      out.push(`Find something for ${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`)
      break
    }
  }

  if (week.length === 0 && out.length < 4) out.push('Find a circle near me')
  return out.slice(0, 4)
}
