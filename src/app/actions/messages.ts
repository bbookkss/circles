'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function sendMessage(recipientId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const text = content.trim()
  if (!text) return { error: 'Message cannot be empty' }
  if (text.length > 2000) return { error: 'Message too long' }

  // RLS also enforces the mutual-follow requirement; this returns its error if not met.
  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    recipient_id: recipientId,
    content: text,
  })
  if (error) return { error: 'You can only message people who follow you back.' }

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
