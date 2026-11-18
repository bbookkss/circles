'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { reverseGeocode } from '@/lib/geocoding'
import type { CirclePlace } from '@/lib/approxLocation'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const full_name = (formData.get('full_name') as string).trim()
  if (!full_name) return

  const bio = (formData.get('bio') as string | null)?.trim() ?? null

  // Normalize the Instagram handle: strip a leading @, spaces, and any full URL
  const rawIg = (formData.get('instagram') as string | null)?.trim() ?? ''
  const instagram = rawIg
    ? rawIg.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '').trim() || null
    : null

  const rawUsername = (formData.get('username') as string | null)?.trim().toLowerCase() ?? ''
  if (rawUsername && !/^[a-z0-9_]{3,20}$/.test(rawUsername)) {
    return { error: 'Username must be 3-20 characters: letters, numbers or underscores' }
  }
  const username = rawUsername || null

  // Same reasoning as signup: an unchecked box submits nothing.
  const email_reminders = formData.get('email_reminders') === 'on'

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, bio, instagram, username, email_reminders })
    .eq('id', user.id)

  // 23505 is the unique index on lower(username).
  if (error) {
    if (error.code === '23505') return { error: 'That username is taken' }
    return { error: error.message }
  }

  revalidatePath('/profile')
  revalidatePath('/home')
  return { success: true }
}

export async function backfillNeighborhoods(): Promise<{ updated: number; errors: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { updated: 0, errors: 0 }

  // Find this user's circles that have coordinates but no neighborhood or city.
  // The coordinates come from circle_places(), the only way to read them.
  const { data: created } = await supabase
    .from('circles')
    .select('id')
    .eq('created_by', user.id)
  const createdIds = (created ?? []).map((c) => c.id)
  const { data: places } = createdIds.length > 0
    ? await supabase.rpc('circle_places', { cids: createdIds })
    : { data: [] }
  const circles = ((places ?? []) as CirclePlace[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ id: p.circle_id, latitude: p.latitude, longitude: p.longitude }))

  if (!circles || circles.length === 0) return { updated: 0, errors: 0 }

  let updated = 0
  let errors = 0

  for (const circle of circles) {
    try {
      const { neighborhood, city } = await reverseGeocode(circle.longitude!, circle.latitude!)

      if (neighborhood || city) {
        await supabase.from('circles').update({ neighborhood, city }).eq('id', circle.id)
        updated++
      }
    } catch {
      errors++
    }
  }

  revalidatePath('/explore')
  return { updated, errors }
}
