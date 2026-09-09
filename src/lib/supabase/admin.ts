import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * A Supabase client holding the service-role key. It bypasses RLS entirely,
 * so it must never be reachable from the browser — hence the `server-only`
 * import above, which turns a stray client-side import into a build error.
 *
 * The only thing this is used for is resolving a username to the email
 * address Supabase authenticates against. That lookup deliberately has no
 * public API: the anon key ships in the page source, so exposing it through
 * PostgREST would let anyone walk the public username list and harvest every
 * user's email.
 *
 * Keep the surface small. If something can be done with the ordinary
 * anon-key client and a policy, do it that way instead.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // The Supabase integration provisions the legacy name; newer projects use
  // SUPABASE_SECRET_KEY. Accept either.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error(
      'Username sign-in needs SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) set.'
    )
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
