'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const full_name = (formData.get('full_name') as string).trim()
  if (!full_name) return

  await supabase.from('profiles').update({ full_name }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/dashboard')
}
