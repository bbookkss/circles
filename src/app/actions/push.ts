'use server'

import { createClient } from '@/lib/supabase/server'
import { pushConfigured, sendPush } from '@/lib/push'

/**
 * Turning notifications on and off for one device. The subscription is the
 * browser's own object (endpoint + keys); it is stored against the signed-in
 * person by RLS (user_id defaults to auth.uid() and the policy checks it).
 */

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

export async function savePushSubscription(sub: Sub) {
  if (!pushConfigured()) return { error: 'Notifications are not set up yet.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
    return { error: 'That subscription looks wrong.' }
  }

  // The same device re-subscribing (or another account on it) replaces the
  // old row rather than failing on the unique endpoint.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  const { error } = await supabase.from('push_subscriptions').insert({ endpoint, p256dh, auth })
  if (error) return { error: 'Could not turn on notifications.' }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || typeof endpoint !== 'string') return { error: 'Not signed in' }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return { ok: true }
}

/** "Send me a test": proves the whole path on this person's own devices. */
export async function sendTestPush() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const n = await sendPush(user.id, { title: 'Circles', body: 'Notifications are on.', url: '/profile', tag: 'test' })
  return n ? { ok: true } : { error: 'No device got it. Try turning notifications off and on again.' }
}
