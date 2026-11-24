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

const PUSH_KEYS = [
  'push_checkin_open', 'push_soon', 'push_messages', 'push_friends', 'push_going', 'push_changes', 'push_requests',
] as const
export type PushPrefKey = (typeof PUSH_KEYS)[number]

/** One notification switch on or off, for this person, on every device. */
export async function savePushPref(key: PushPrefKey, on: boolean) {
  if (!PUSH_KEYS.includes(key) || typeof on !== 'boolean') return { error: 'bad setting' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, [key]: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error ? { error: 'Could not save' } : { ok: true }
}
