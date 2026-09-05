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

export async function toggleLike(postId: string, circleId: string, like: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (like) {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    // Ignore duplicate-key errors (already liked)
    if (error && !error.message.includes('duplicate')) return { error: error.message }

    // Notify the post author
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).maybeSingle()
    if (post && post.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id, actor_id: user.id, type: 'post_like', circle_id: circleId, post_id: postId,
      })
    }
  } else {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
  }

  revalidatePath(`/circles/${circleId}`)
  return { success: true }
}

export async function toggleCommentLike(commentId: string, circleId: string, like: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (like) {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    if (error && !error.message.includes('duplicate')) return { error: error.message }

    // Notify the comment author
    const { data: comment } = await supabase.from('post_comments').select('user_id, post_id').eq('id', commentId).maybeSingle()
    if (comment && comment.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: comment.user_id, actor_id: user.id, type: 'comment_like', circle_id: circleId, post_id: comment.post_id, comment_id: commentId,
      })
    }
  } else {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
  }

  revalidatePath(`/circles/${circleId}`)
  return { success: true }
}

export async function addComment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const post_id = formData.get('post_id') as string
  const circle_id = formData.get('circle_id') as string
  const content = (formData.get('content') as string)?.trim()

  if (!content) return { error: 'Comment cannot be empty' }
  if (content.length > 500) return { error: 'Comment too long (max 500 characters)' }

  const { data: inserted, error } = await supabase.from('post_comments').insert({
    post_id,
    user_id: user.id,
    content,
  }).select('id').single()

  if (error) return { error: error.message }

  // Notify the post author
  const { data: post } = await supabase.from('posts').select('user_id').eq('id', post_id).maybeSingle()
  if (post && post.user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: post.user_id, actor_id: user.id, type: 'post_comment', circle_id, post_id, comment_id: inserted.id,
    })
  }

  revalidatePath(`/circles/${circle_id}`)
  return { success: true }
}

export async function deleteComment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const comment_id = formData.get('comment_id') as string
  const circle_id = formData.get('circle_id') as string

  await supabase.from('post_comments').delete().eq('id', comment_id).eq('user_id', user.id)

  revalidatePath(`/circles/${circle_id}`)
}
