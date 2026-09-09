'use server'

import { redirect } from 'next/navigation'
import tzLookup from 'tz-lookup'
import { createClient, getAuthUser } from '@/lib/supabase/server'

/**
 * A circle's timezone comes from its pin, not from the server's locale. It
 * decides what "today" means for schedules and for the check-in window, so a
 * Florida circle must not be evaluated in Pacific time.
 *
 * Falls back rather than throwing: a circle with no pin is still a valid
 * circle, and tz-lookup can be given a coordinate it cannot place.
 */
function timezoneFor(latitude: number, longitude: number): string {
  if (isNaN(latitude) || isNaN(longitude)) return 'America/Los_Angeles'
  try {
    return tzLookup(latitude, longitude)
  } catch {
    return 'America/Los_Angeles'
  }
}

export async function createCircle(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as string
  const location = formData.get('location') as string
  const emoji = formData.get('emoji') as string
  const visibility = formData.get('visibility') as string || 'public'
  // Only verified businesses may set this. The UI hides the option, and a
  // trigger on circles rejects it outright, so this is the third line rather
  // than the only one.
  const kind = formData.get('kind') === 'commercial' ? 'commercial' : 'social'
  const neighborhood = formData.get('neighborhood') as string
  const city = formData.get('city') as string
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
      kind,
      neighborhood: neighborhood?.trim() || null,
      city: city?.trim() || null,
      latitude: isNaN(latitude) ? null : latitude,
      longitude: isNaN(longitude) ? null : longitude,
      timezone: timezoneFor(latitude, longitude),
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
    // Anchors the recurrence. Without it 'biweekly' has no meaning — nothing
    // says which week is the on week. Defaults to today if the form omits it.
    const starts_on = (formData.get('starts_on') as string)?.trim() || null

    await supabase.from('circle_schedules').insert({
      circle_id: data.id,
      days_of_week: days,
      start_time,
      end_time,
      frequency: frequency || 'weekly',
      starts_on,
      note: schedule_note?.trim() || null,
    })
  }

  redirect(`/circles/${data.id}`)
}

export async function updateCircle(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
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
  const city = formData.get('city') as string

  await supabase.from('circles').update({
    name: name.trim(),
    description: (formData.get('description') as string)?.trim() || null,
    category: (formData.get('category') as string) || null,
    location: (formData.get('location') as string)?.trim() || null,
    emoji: (formData.get('emoji') as string) || null,
    visibility: (formData.get('visibility') as string) || 'public',
    neighborhood: neighborhood?.trim() || null,
    city: city?.trim() || null,
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
    // Moving the pin can move the circle across a timezone boundary.
    timezone: timezoneFor(latitude, longitude),
  }).eq('id', circle_id)

  // Replace schedule if days provided
  const days = formData.getAll('days_of_week').map(Number).filter((d) => !isNaN(d))
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string

  if (days.length > 0 && start_time && end_time) {
    const starts_on = (formData.get('starts_on') as string)?.trim() || null

    await supabase.from('circle_schedules').delete().eq('circle_id', circle_id)
    await supabase.from('circle_schedules').insert({
      circle_id,
      days_of_week: days,
      start_time,
      end_time,
      frequency: (formData.get('frequency') as string) || 'weekly',
      starts_on,
      note: (formData.get('schedule_note') as string)?.trim() || null,
    })
  }

  redirect(`/circles/${circle_id}`)
}

export async function joinCircle(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_members').insert({ circle_id, user_id: user.id, role: 'member' })
  redirect(`/circles/${circle_id}`)
}

export async function leaveCircle(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_members').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  redirect(`/circles/${circle_id}`)
}

export async function requestToJoin(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_join_requests').insert({ circle_id, user_id: user.id })

  // Notify the circle's admins
  const { data: admins } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circle_id)
    .eq('role', 'admin')
  const rows = (admins ?? [])
    .filter((a) => a.user_id !== user.id)
    .map((a) => ({ user_id: a.user_id, actor_id: user.id, type: 'join_request', circle_id }))
  if (rows.length > 0) await supabase.from('notifications').insert(rows)

  redirect(`/circles/${circle_id}`)
}

export async function withdrawRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_join_requests').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  redirect(`/circles/${circle_id}`)
}

export async function approveRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const request_user_id = formData.get('user_id') as string

  await supabase.from('circle_join_requests').update({ status: 'approved' })
    .eq('circle_id', circle_id).eq('user_id', request_user_id)

  await supabase.from('circle_members').insert({
    circle_id, user_id: request_user_id, role: 'member',
  })

  // Notify the requester that they're in
  await supabase.from('notifications').insert({
    user_id: request_user_id, actor_id: user.id, type: 'request_approved', circle_id,
  })

  redirect(`/circles/${circle_id}/requests`)
}

export async function rejectRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const request_user_id = formData.get('user_id') as string

  await supabase.from('circle_join_requests').update({ status: 'rejected' })
    .eq('circle_id', circle_id).eq('user_id', request_user_id)

  redirect(`/circles/${circle_id}/requests`)
}
