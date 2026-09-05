'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { reverseGeocode } from '@/lib/geocoding'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const full_name = (formData.get('full_name') as string).trim()
  if (!full_name) return

  await supabase.from('profiles').update({ full_name }).eq('id', user.id)
  revalidatePath('/profile')
  revalidatePath('/home')
}

export async function backfillNeighborhoods(): Promise<{ updated: number; errors: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { updated: 0, errors: 0 }

  // Find this user's circles that have coordinates but no neighborhood or city
  const { data: circles } = await supabase
    .from('circles')
    .select('id, latitude, longitude')
    .eq('created_by', user.id)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

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
