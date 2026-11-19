import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * A Supabase client with the anon key and no session, for public search.
 *
 * Public search must see exactly what a signed-out visitor sees, and nothing
 * more. With no session there is no user, so every query runs as `anon` and
 * RLS plus the column grants on `circles` decide the result: public circles
 * only, and their area rather than their exact place. The server client in
 * ./server.ts would carry a signed-in visitor's cookies, so it is not used here,
 * and the admin client must never be.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase URL and anon key must be set.')
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
