import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Rate limits and spend caps, kept in Supabase (supabase/ai-2026-11-18.sql).
 *
 * This is the one place the AI code touches the service-role client, and it
 * only calls the two quota functions. Agent tools never import this file or
 * the admin client; src/lib/ai/guard.test.ts fails the build if they do.
 *
 * Fails closed: if the quota store can't be reached, the request is refused.
 * An outage there must not turn into an unmetered API.
 */

export type Rule = { bucket: string; windowSeconds: number; maxRequests: number; maxTokens?: number }

/** Bucket name reported when the quota store itself can't be reached. */
export const QUOTA_UNAVAILABLE = 'unavailable'

export async function takeQuota(rules: Rule[]): Promise<{ ok: true } | { ok: false; bucket: string }> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, bucket: QUOTA_UNAVAILABLE }
  }
  for (const r of rules) {
    const { data, error } = await admin.rpc('ai_take_quota', {
      p_bucket: r.bucket,
      p_window_seconds: r.windowSeconds,
      p_max_requests: r.maxRequests,
      p_max_tokens: r.maxTokens ?? null,
    })
    if (error) return { ok: false, bucket: QUOTA_UNAVAILABLE }
    if (data !== true) return { ok: false, bucket: r.bucket }
  }
  return { ok: true }
}

export async function addTokens(buckets: { bucket: string; windowSeconds: number }[], tokens: number) {
  if (!tokens) return
  let admin: ReturnType<typeof createAdminClient>
  try { admin = createAdminClient() } catch { return }
  await Promise.all(
    buckets.map((b) =>
      admin.rpc('ai_add_tokens', { p_bucket: b.bucket, p_window_seconds: b.windowSeconds, p_tokens: tokens })
    )
  )
}
