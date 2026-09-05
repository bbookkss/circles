'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as string
  const location = formData.get('location') as string
  const emoji = formData.get('emoji') as string
  const visibility = formData.get('visibility') as string || 'public'
  const neighborhood = formData.get('neighborhood') as string
  const latitude = parseFloat(formData.get('latitude') as string)
  const longitude = parseFloat(formData.get('longitude') as string)

  if (!name.trim()) return { error: 'Name is required' }

  const { data, error } = await supabase
    .from('circles')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || null,
      location: location?.trim() || null,
      emoji: emoji || null,
      visibility,
      neighborhood: neighborhood?.trim() || null,
      latitude: isNaN(latitude) ? null : latitude,
      longitude: isNaN(longitude) ? null : longitude,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Creator auto-joins as admin
  await supabase.from('circle_members').insert({
    circle_id: data.id,
    user_id: user.id,
    role: 'admin',
  })

  // Save schedule if provided
  const days = formData.getAll('days_of_week').map(Number).filter((d) => !isNaN(d))
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const frequency = formData.get('frequency') as string
  const schedule_note = formData.get('schedule_note') as string

  if (days.length > 0 && start_time && end_time) {
    await supabase.from('circle_schedules').insert({
      circle_id: data.id,
      days_of_week: days,
      start_time,
      end_time,
      frequency: frequency || 'weekly',
      note: schedule_note?.trim() || null,
    })
  }

  redirect(`/circles/${data.id}`)
}

export async function updateCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const circle_id = formData.get('circle_id') as string

  // Verify admin
  const { data: membership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'admin') return { error: 'Not authorized' }

  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Name is required' }

  const latitude = parseFloat(formData.get('latitude') as string)
  const longitude = parseFloat(formData.get('longitude') as string)
  const neighborhood = formData.get('neighborhood') as string

  await supabase.from('circles').update({
    name: name.trim(),
    description: (formData.get('description') as string)?.trim() || null,
    category: (formData.get('category') as string) || null,
    location: (formData.get('location') as string)?.trim() || null,
    emoji: (formData.get('emoji') as string) || null,
    visibility: (formData.get('visibility') as string) || 'public',
    neighborhood: neighborhood?.trim() || null,
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
  }).eq('id', circle_id)

  // Replace schedule if days provided
  const days = formData.getAll('days_of_week').map(Number).filter((d) => !isNaN(d))
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string

  if (days.length > 0 && start_time && end_time) {
    await supabase.from('circle_schedules').delete().eq('circle_id', circle_id)
    await supabase.from('circle_schedules').insert({
      circle_id,
      days_of_week: days,
      start_time,
      end_time,
      frequency: (formData.get('frequency') as string) || 'weekly',
      note: (formData.get('schedule_note') as string)?.trim() || null,
    })
  }

  redirect(`/circles/${circle_id}`)
}

export async function joinCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_members').insert({ circle_id, user_id: user.id, role: 'member' })
  redirect(`/circles/${circle_id}`)
}

export async function leaveCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_members').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  redirect(`/circles/${circle_id}`)
}

export async function requestToJoin(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_join_requests').insert({ circle_id, user_id: user.id })
  redirect(`/circles/${circle_id}`)
}

export async function withdrawRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_join_requests').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  redirect(`/circles/${circle_id}`)
}

export async function approveRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const request_user_id = formData.get('user_id') as string

  await supabase.from('circle_join_requests').update({ status: 'approved' })
    .eq('circle_id', circle_id).eq('user_id', request_user_id)

  await supabase.from('circle_members').insert({
    circle_id, user_id: request_user_id, role: 'member',
  })

  redirect(`/circles/${circle_id}/requests`)
}

export async function rejectRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const request_user_id = formData.get('user_id') as string

  await supabase.from('circle_join_requests').update({ status: 'rejected' })
    .eq('circle_id', circle_id).eq('user_id', request_user_id)

  redirect(`/circles/${circle_id}/requests`)
}
