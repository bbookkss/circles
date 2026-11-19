'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * An answer for a meet whose check-in hasn't opened yet.
 *
 * The check-in trigger refuses early answers, so this one waits in
 * scheduled_check_ins (ai-2026-11-18.sql) until apply_scheduled_check_ins()
 * writes it, on pg_cron, once the window opens. RLS limits the rows to the
 * person's own, for circles they belong to, and only before the answer has
 * been applied. A real check-in given by hand in the meantime wins.
 *
 * Called by the person tapping a button on an Ask Circles card, never by the
 * assistant itself.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function scheduleCheckIn(circleId: string, occursOn: string, status: string) {
  if (!UUID.test(circleId) || !DATE.test(occursOn)) return { error: 'Missing circle or date' }
  if (!['yes', 'no', 'maybe'].includes(status)) return { error: 'Invalid response' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('scheduled_check_ins')
    .upsert(
      { user_id: user.id, circle_id: circleId, occurs_on: occursOn, status },
      { onConflict: 'user_id,circle_id,occurs_on' }
    )
  if (error) return { error: "Couldn't save that. Try again." }

  revalidatePath('/home')
  return { success: true }
}

export async function cancelScheduledCheckIn(circleId: string, occursOn: string) {
  if (!UUID.test(circleId) || !DATE.test(occursOn)) return { error: 'Missing circle or date' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('scheduled_check_ins')
    .delete()
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .eq('occurs_on', occursOn)
  if (error) return { error: "Couldn't undo that. Try again." }

  revalidatePath('/home')
  return { success: true }
}
