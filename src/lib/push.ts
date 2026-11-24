import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Sending Web Push notifications.
 *
 * Off unless all three VAPID values are set: the switch in the app is hidden
 * (pushConfigured) and every send is a no-op, the same as email without a
 * provider.
 *
 * Reads subscriptions with the service role because the sender is never the
 * recipient: a message's sender, or the cron. Only ever called with a user id
 * the caller already had a reason to notify. A subscription the push service
 * says is gone (404/410) is deleted, so uninstalling the app cleans up.
 */

export type PushPayload = {
  title: string
  body: string
  /** Path to open when tapped, e.g. /messages/<id>. Same-origin only. */
  url: string
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  )
}

let ready = false
function setup() {
  if (ready) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  ready = true
}

/** Plain, short text: notifications show on a lock screen. */
function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/** Sends to every device the person turned notifications on for. Returns how many got it. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0
  setup()
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs?.length) return 0

  const body = JSON.stringify({
    title: clip(payload.title, 60),
    body: clip(payload.body, 140),
    url: payload.url.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/home',
    tag: payload.tag,
  })

  let delivered = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          body,
          { TTL: 60 * 60 * 6, urgency: 'normal', timeout: 8000 }
        )
        delivered++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    })
  )
  return delivered
}
