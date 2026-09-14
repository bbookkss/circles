'use server'

import { redirect } from 'next/navigation'
import tzLookup from 'tz-lookup'
import { createClient } from '@/lib/supabase/server'

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
  const { data: { user } } = await supabase.auth.getUser()
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
  const city = formData.get('city') as string

  const visibility = (formData.get('visibility') as string) || 'public'
  if (visibility !== 'public' && visibility !== 'private') {
    return { error: 'Visibility must be public or private' }
  }

  // .select() so a policy refusal shows up as zero rows rather than as a
  // silent success. Before the admin-keyed policies landed, a second admin's
  // edit here affected 0 rows and the redirect hid it every time.
  const { data: updated, error } = await supabase.from('circles').update({
    name: name.trim(),
    description: (formData.get('description') as string)?.trim() || null,
    category: (formData.get('category') as string) || null,
    location: (formData.get('location') as string)?.trim() || null,
    emoji: (formData.get('emoji') as string) || null,
    visibility,
    neighborhood: neighborhood?.trim() || null,
    city: city?.trim() || null,
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
    // Moving the pin can move the circle across a timezone boundary.
    timezone: timezoneFor(latitude, longitude),
  }).eq('id', circle_id).select('id')

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: 'You are not allowed to edit this circle' }

  // Replace schedule if days provided
  const days = formData.getAll('days_of_week').map(Number).filter((d) => !isNaN(d))
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string

  if (days.length > 0 && start_time && end_time) {
    const starts_on = (formData.get('starts_on') as string)?.trim() || null

    const { error: delError } = await supabase
      .from('circle_schedules').delete().eq('circle_id', circle_id)
    if (delError) return { error: delError.message }

    const { error: insError } = await supabase.from('circle_schedules').insert({
      circle_id,
      days_of_week: days,
      start_time,
      end_time,
      frequency: (formData.get('frequency') as string) || 'weekly',
      starts_on,
      note: (formData.get('schedule_note') as string)?.trim() || null,
    })
    if (insError) return { error: insError.message }
  }

  redirect(`/circles/${circle_id}`)
}

export async function joinCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string

  // The policy is the real gate (public circles only, member role only).
  // This check exists so a person who posts a private circle's id gets a
  // sentence instead of an RLS error code.
  const { data: circle } = await supabase
    .from('circles').select('visibility').eq('id', circle_id).maybeSingle()
  if (!circle) redirectWithError('/explore', 'That circle does not exist.')
  if (circle.visibility !== 'public') {
    redirectWithError(`/circles/${circle_id}`, 'This circle is private. Ask to join instead.')
  }

  const { error } = await supabase
    .from('circle_members')
    .insert({ circle_id, user_id: user.id, role: 'member' })
  // 23505: already a member. Not an error worth showing.
  if (error && error.code !== '23505') redirectWithError(`/circles/${circle_id}`, error.message)

  redirect(`/circles/${circle_id}`)
}

export async function leaveCircle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string

  // The UI hides Leave for admins, but the action is callable directly, and
  // an admin leaving as the last admin strands the circle with nobody who
  // can edit it. That was the state five circles were in before the reset.
  const { data: admins } = await supabase
    .from('circle_members').select('user_id').eq('circle_id', circle_id).eq('role', 'admin')
  const soleAdmin = (admins ?? []).length === 1 && admins![0].user_id === user.id
  if (soleAdmin) {
    redirectWithError(`/circles/${circle_id}`, 'Make someone else an admin before you leave.')
  }

  const { error } = await supabase.from('circle_members').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  if (error) redirectWithError(`/circles/${circle_id}`, error.message)

  redirect(`/circles/${circle_id}`)
}

export async function requestToJoin(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const { error } = await supabase
    .from('circle_join_requests')
    .insert({ circle_id, user_id: user.id })
  // 23505 is the (circle_id, user_id) unique key: a request already exists,
  // pending or decided. Either way there is nothing new to tell the admins.
  if (error?.code === '23505') redirect(`/circles/${circle_id}`)
  if (error) redirectWithError(`/circles/${circle_id}`, error.message)

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  await supabase.from('circle_join_requests').delete()
    .eq('circle_id', circle_id)
    .eq('user_id', user.id)
  redirect(`/circles/${circle_id}`)
}

/**
 * Send someone back to a page with an error they can read.
 *
 * Form actions discard their return value, so `return { error }` from one is
 * a silent failure with extra steps. This used to be how every action here
 * failed: the update affected 0 rows, the redirect fired, the page looked
 * identical, and nobody learned anything. The query string is the one channel
 * a redirect carries.
 */
function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

export async function approveRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const circle_id = formData.get('circle_id') as string
  const request_user_id = formData.get('user_id') as string

  // One security-definer call: admin check, status update, membership insert
  // and notification, atomically. Doing these as three client writes is what
  // broke approval: RLS lets a person insert only their own membership row,
  // so the admin's insert of the requester was refused and the redirect hid it.
  const { error } = await supabase.rpc('approve_join_request', {
    p_circle: circle_id,
    p_user: request_user_id,
  })
  if (error) redirectWithError(`/circles/${circle_id}/requests`, error.message)

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
