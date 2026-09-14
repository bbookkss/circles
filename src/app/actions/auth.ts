'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve a username to the email Supabase authenticates against.
 *
 * Uses the service-role key, and is never exposed as an API: the anon key is
 * public, so a callable lookup would let anyone turn the public username list
 * into a list of email addresses.
 */
async function emailForUsername(username: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  if (!profile) return null

  const { data } = await admin.auth.admin.getUserById(profile.id)
  return data?.user?.email ?? null
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  // The field accepts either. Older callers still post `email`.
  const identifier = ((formData.get('identifier') ?? formData.get('email')) as string)?.trim()
  const password = formData.get('password') as string

  if (!identifier) return { error: 'Enter your email or username' }

  let email = identifier
  if (!identifier.includes('@')) {
    const resolved = await emailForUsername(identifier)
    // Deliberately the same message as a bad password, so this cannot be used
    // to find out which usernames exist.
    if (!resolved) return { error: 'Invalid login credentials' }
    email = resolved
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/home')
}

async function siteOrigin() {
  const h = await headers()
  return h.get('origin') ?? `https://${h.get('host')}`
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Enter your email' }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  })

  // Always the same answer, whether or not the account exists — otherwise this
  // form tells a stranger which email addresses are registered.
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  if (password !== confirm) return { error: 'Passwords do not match' }

  // Following the emailed link establishes a session; without one the link has
  // expired or was never followed.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'This link has expired. Request a new one.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const full_name = (formData.get('full_name') as string)?.trim()
  if (!full_name) return { error: 'Your name is required' }

  // Three fields, and this is all of them. Instagram, username and the email
  // opt-in were asked here and are now asked on the profile, where somebody
  // has seen a circle and the reason for each is obvious. Both columns are
  // nullable and email_reminders defaults to false, so their absence needs no
  // migration and opts nobody in.
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: { data: { full_name } },
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

export async function deleteAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  // Typed confirmation, checked server-side so it cannot be skipped by
  // posting to the action directly.
  if ((formData.get('confirm') as string)?.trim().toLowerCase() !== 'delete') {
    return { error: 'Type delete to confirm' }
  }

  // Hands off admin of any circle we are the last admin of, deletes circles
  // we are the last member of, then removes the auth user. Everything else
  // goes by cascade; posts and comments are kept and unattributed.
  const { error } = await supabase.rpc('delete_own_account')
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
