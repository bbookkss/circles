'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createPost(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const circle_id = formData.get('circle_id') as string
  const content = (formData.get('content') as string)?.trim()

  if (!content) return { error: 'Post cannot be empty' }
  if (content.length > 1000) return { error: 'Post too long (max 1000 characters)' }

  const { error } = await supabase.from('posts').insert({
    circle_id,
    user_id: user.id,
    content,
  })

  if (error) return { error: error.message }

  revalidatePath(`/circles/${circle_id}`)
  return { success: true }
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const post_id = formData.get('post_id') as string
  const circle_id = formData.get('circle_id') as string

  await supabase.from('posts').delete().eq('id', post_id).eq('user_id', user.id)

  revalidatePath(`/circles/${circle_id}`)
}
