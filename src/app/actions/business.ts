'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export async function submitBusinessRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'Not signed in' }

  const business_name = (formData.get('business_name') as string)?.trim()
  if (!business_name) return { error: 'Business name is required' }

  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  if (!phone && !email) {
    return { error: 'Give us a phone number or an email so we can reach you' }
  }

  const { error } = await supabase.from('business_requests').insert({
    user_id: user.id,
    business_name,
    contact_name: (formData.get('contact_name') as string)?.trim() || null,
    phone,
    email,
    message: (formData.get('message') as string)?.trim() || null,
  })

  // A partial unique index allows only one pending request per person.
  if (error) {
    if (error.code === '23505') return { error: 'You already have a request pending.' }
    return { error: error.message }
  }

  revalidatePath('/business')
  return { success: true }
}

export async function reviewBusinessRequest(formData: FormData) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return { error: 'Not signed in' }

  const request_id = formData.get('request_id') as string
  const approve = formData.get('approve') === 'true'

  // Authorisation lives in the function, which checks platform_admins itself.
  const { error } = await supabase.rpc('review_business_request', { request_id, approve })
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}
