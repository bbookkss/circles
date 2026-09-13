'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Unsubscribe by token, without signing in.
 *
 * Uses the service-role client because the suppression list is revoked from
 * both anon and authenticated. It has to be: it is a table of email
 * addresses, and the anon key ships in the page source.
 *
 * The token is the whole authorisation. It is a random uuid stored on the
 * profile, not the user id, so it cannot be derived from anything public and
 * can be rotated if a link leaks. Knowing it proves you received an email we
 * sent to that address, which is exactly the bar an unsubscribe link should
 * clear. Deliberately no session check: a person who cannot remember their
 * password is still entitled to stop the email.
 */

export type UnsubscribeResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'unknown-token' | 'failed' }

/** Look up who a token belongs to, for the confirmation page. */
export async function whoIsUnsubscribing(
  token: string
): Promise<{ email: string; fullName: string | null } | null> {
  if (!isUuid(token)) return null
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('unsubscribe_token', token)
    .maybeSingle()
  if (!profile) return null

  const { data: user } = await admin.auth.admin.getUserById(profile.id)
  const email = user?.user?.email
  if (!email) return null

  return { email, fullName: profile.full_name ?? null }
}

/**
 * Stop the email. Both halves matter and neither is enough alone.
 *
 * The preference flag stops future reminders for this account. The
 * suppression row stops anything being sent to the address at all, and
 * survives the account being deleted and recreated, which the flag cannot.
 */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  if (!isUuid(token)) return { ok: false, reason: 'unknown-token' }
  const admin = createAdminClient()

  const who = await whoIsUnsubscribing(token)
  if (!who) return { ok: false, reason: 'unknown-token' }

  const { error: prefError } = await admin
    .from('profiles')
    .update({ email_reminders: false })
    .eq('unsubscribe_token', token)

  const { error: suppressError } = await admin
    .from('email_suppressions')
    .upsert({ email: who.email, reason: 'user_request' }, { onConflict: 'email' })

  if (prefError || suppressError) return { ok: false, reason: 'failed' }
  return { ok: true, email: who.email }
}

/** Tokens are uuids; anything else is not worth a database round trip. */
function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}
