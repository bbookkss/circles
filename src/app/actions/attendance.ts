'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * File the register for a meet that has already happened.
 *
 * Everything that could be got wrong is checked in `record_attendance`:
 * that the caller is a member, that the date is a real occurrence of the
 * schedule, that the meet is over, and that the people being marked actually
 * answered for it. This only carries the form across and reports the refusal.
 */
export async function recordAttendance(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const circle_id = formData.get('circle_id') as string
  const occurs_on = formData.get('occurs_on') as string
  const attended = formData.getAll('attended').map(String).filter(Boolean)
  const absent = formData.getAll('absent').map(String).filter(Boolean)

  if (!circle_id || !occurs_on) return { error: 'Missing circle or date' }

  const { error } = await supabase.rpc('record_attendance', {
    p_circle: circle_id,
    p_occurs_on: occurs_on,
    p_attended: attended,
    p_absent: absent,
  })
  if (error) return { error: error.message }

  revalidatePath(`/circles/${circle_id}`)
  revalidatePath('/profile')
  return { success: true }
}
