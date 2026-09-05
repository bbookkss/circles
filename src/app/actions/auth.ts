'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const full_name = (formData.get('full_name') as string)?.trim()
  const rawIg = (formData.get('instagram') as string | null)?.trim() ?? ''
  const instagram = rawIg
    ? rawIg.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '').trim()
    : ''

  if (!instagram) return { error: 'Instagram handle is required' }

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name,
        instagram,
      },
    },
  })

  if (error) return { error: error.message }

  // No session means Supabase requires email confirmation
  if (!data.session) {
    redirect('/check-email')
  }

  revalidatePath('/', 'layout')
  redirect('/welcome')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
