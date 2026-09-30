'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Promote a member to admin, or step one back down.
 *
 * Everything is checked in `set_member_role`: that the caller is an admin of
 * this circle, that the target is actually in it, that the role is real, and
 * that the last admin cannot demote themselves and strand the circle. This
 * carries the form across and reports the refusal.
 */
export async function setMemberRole(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const circle_id = formData.get('circle_id') as string
  const user_id = formData.get('user_id') as string
  const role = formData.get('role') as string
  if (!circle_id || !user_id || !role) return { error: 'Missing circle, person or role' }

  const { error } = await supabase.rpc('set_member_role', {
    p_circle: circle_id,
    p_user: user_id,
    p_role: role,
  })
  if (error) return { error: error.message }

  revalidatePath(`/circles/${circle_id}`)
  return { success: true }
}
