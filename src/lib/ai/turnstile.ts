import 'server-only'

/**
 * Cloudflare Turnstile, the bot check in front of public search.
 *
 * Fails closed in production: without TURNSTILE_SECRET_KEY the public search
 * refuses every request. In development, with no key, the check is skipped
 * so the feature can be worked on locally.
 */
export function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return process.env.NODE_ENV !== 'production'
  if (!token || token.length > 2048) return false
  const body = new URLSearchParams({ secret, response: token })
  if (ip !== 'local' && ip !== 'unknown') body.set('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    const out = (await res.json()) as { success?: boolean }
    return out.success === true
  } catch {
    return false
  }
}
