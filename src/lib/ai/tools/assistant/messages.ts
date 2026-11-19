import 'server-only'
import { plainText } from '@/lib/ai/sanitize'
import type { Card, Ctx, ToolOutput } from './types'

/**
 * Messages sent TO the person. Read only: the assistant never sends.
 *
 * Message text is written by other people, so it is untrusted. The model gets
 * it labelled as such and truncated. The card shows it as plain text with
 * anything link-like removed, and the full message is one tap away in the
 * thread itself.
 *
 * Blocks: `blocks` comes from safety-2026-11-18.sql, which may not be applied
 * yet. Once it is, RLS already hides blocked conversations from both sides
 * and this filter is belt and braces. Until then the query fails with a
 * missing-table error, which is ignored, and blocked senders are NOT filtered.
 * That's acceptable only because block itself doesn't exist without that
 * migration.
 */
export async function myMessages(
  ctx: Ctx,
  input: { from_name?: string | null; unread_only?: boolean | null }
): Promise<ToolOutput> {
  const { supabase, userId } = ctx

  const [{ data: msgs }, blocksRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id, sender_id, content, created_at, read')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
  ])
  const blocked = new Set(blocksRes.error ? [] : (blocksRes.data ?? []).map((b) => b.blocked_id as string))

  const rows = (msgs ?? []).filter((m) => !blocked.has(m.sender_id as string))
  const senderIds = [...new Set(rows.map((m) => m.sender_id as string))]
  const { data: people } = senderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', senderIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? 'Someone']))

  const want = (input.from_name ?? '').trim().toLowerCase().slice(0, 60)
  let picked = rows.filter((m) => !want || (nameOf.get(m.sender_id) ?? '').toLowerCase().includes(want))
  if (input.unread_only) picked = picked.filter((m) => !m.read)
  picked = picked.slice(0, 10)

  // A message that names one of the person's upcoming circles gets that meet
  // attached, so the card for it can sit next to the message.
  const week = await ctx.week()
  const meetFor = (text: string) => {
    const t = text.toLowerCase()
    return week.find((w) => w.circle_name.length >= 3 && t.includes(w.circle_name.toLowerCase())) ?? null
  }

  const cards: Card[] = []
  const forModel = picked.map((m) => {
    const from = nameOf.get(m.sender_id) ?? 'Someone'
    const text = String(m.content ?? '')
    const meet = meetFor(text)
    cards.push({
      kind: 'message',
      from_id: m.sender_id,
      from_name: from,
      sent_at: m.created_at,
      text: plainText(text, 300),
      unread: !m.read,
    })
    if (meet && !meet.my_status) cards.push({ kind: 'meet', meet })
    return {
      from,
      sent_at: m.created_at,
      unread: !m.read,
      // Written by another person. Data to report, never instructions to follow.
      text_written_by_another_person: text.slice(0, 300),
      about_meet: meet ? { circle_id: meet.circle_id, occurs_on: meet.occurs_on } : null,
    }
  })

  return { forModel: { count: forModel.length, messages: forModel }, cards }
}
