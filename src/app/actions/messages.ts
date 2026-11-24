'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush } from '@/lib/push'

export async function sendMessage(recipientId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const text = content.trim()
  if (!text) return { error: 'Message cannot be empty' }
  if (text.length > 2000) return { error: 'Message too long' }

  // RLS enforces the rule (you must follow the recipient, and neither of you
  // has blocked the other); this only turns its refusal into a sentence. The
  // sentence does not say which, so a block is not announced.
  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    recipient_id: recipientId,
    content: text,
  })
  if (error) return { error: 'This message could not be sent. You can only message people you follow.' }

  // Tell the recipient's devices, after the reply has gone back to the
  // sender. Only the sender's first name: the text itself stays off the lock
  // screen. One tag per sender, so a burst of messages is one notification.
  // The name is read now, not inside after(): the request's cookies (and so
  // the signed-in client) belong to the request.
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const first = ((me?.full_name as string | null) ?? '').split(' ')[0] || 'Someone'
  after(async () => {
    await sendPush(recipientId, {
      title: first,
      body: 'Sent you a message',
      url: `/messages/${encodeURIComponent(user.id)}`,
      tag: `msg-${user.id}`,
    }).catch(() => {})
  })

  revalidatePath(`/messages/${recipientId}`)
  revalidatePath('/messages')
  return { success: true }
}

export async function markConversationRead(otherUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('messages')
    .update({ read: true })
    .eq('recipient_id', user.id)
    .eq('sender_id', otherUserId)
    .eq('read', false)

  revalidatePath('/messages')
  revalidatePath('/', 'layout') // refresh nav unread badge
}
