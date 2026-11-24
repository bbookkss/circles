'use server'

import { createClient } from '@/lib/supabase/server'

/** Saves light or dark (or null: follow the device) to the person's own settings row. */
export async function saveTheme(theme: 'light' | 'dark' | null) {
  if (theme !== null && theme !== 'light' && theme !== 'dark') return { error: 'bad theme' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, theme, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error ? { error: 'Could not save' } : { ok: true }
}
