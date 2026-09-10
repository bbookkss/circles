'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function followUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const following_id = formData.get('following_id') as string
  await supabase.from('follows').insert({ follower_id: user.id, following_id })

  const circle_id = formData.get('circle_id') as string | null
  if (circle_id) revalidatePath(`/circles/${circle_id}`)
  revalidatePath('/profile')
}

export async function unfollowUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const following_id = formData.get('following_id') as string
  await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', following_id)

  const circle_id = formData.get('circle_id') as string | null
  if (circle_id) revalidatePath(`/circles/${circle_id}`)
  revalidatePath('/profile')
}
