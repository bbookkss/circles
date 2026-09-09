'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Say whether you are coming to the next meet.
 *
 * The date is not trusted from the client. A trigger on circle_check_ins
 * re-checks that occurs_on is a real occurrence of that circle's schedule and
 * that the 24-hour window is open, evaluated in the circle's own timezone.
 * Everything here is convenience and error messages.
 */
export async function setCheckIn(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const circle_id = formData.get('circle_id') as string
  const occurs_on = formData.get('occurs_on') as string
  const status = formData.get('status') as string

  if (!['yes', 'no', 'maybe'].includes(status)) return { error: 'Invalid response' }
  if (!circle_id || !occurs_on) return { error: 'Missing circle or date' }

  const { error } = await supabase
    .from('circle_check_ins')
    .upsert(
      { circle_id, user_id: user.id, occurs_on, status },
      { onConflict: 'circle_id,user_id,occurs_on' }
    )

  if (error) return { error: error.message }

  revalidatePath(`/circles/${circle_id}`)
  revalidatePath('/home')
  return { success: true }
}

export async function clearCheckIn(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const circle_id = formData.get('circle_id') as string
  const occurs_on = formData.get('occurs_on') as string

  const { error } = await supabase
    .from('circle_check_ins')
    .delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
    .eq('occurs_on', occurs_on)

  if (error) return { error: error.message }

  revalidatePath(`/circles/${circle_id}`)
  revalidatePath('/home')
  return { success: true }
}
