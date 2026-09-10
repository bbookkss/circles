import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for Server Components and server actions.
 *
 * This client must never refresh a session, and that is the whole point of
 * the options below.
 *
 * A refresh is destructive: Supabase rotates the refresh token, so the old
 * one dies the moment the new one is issued. That is fine where the rotated
 * token can be written back to the browser, and fatal where it cannot. A
 * Server Component cannot set cookies — `cookieStore.set` throws there, and
 * the catch below swallows it — so a refresh started here consumes the only
 * valid refresh token and then drops its replacement on the floor. The
 * session is gone, with no error surfacing anywhere. That is what was
 * logging people out roughly an hour after signing in.
 *
 * `autoRefreshToken: false` removes that path. Refreshing is left to the one
 * place that can persist the result: `src/proxy.ts`, which runs before every
 * matched request and writes rotated cookies onto both the outgoing response
 * and the ongoing request, so by the time a Server Component renders, the
 * token it reads is already fresh and it has no reason to refresh anything.
 *
 * `persistSession: false` says the same thing from the other direction: this
 * client owns no storage worth writing to, and should not try.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component: cookies are read-only here. With refreshing
            // disabled above, the only writes that reach this point are ones
            // middleware has already made, so losing them is harmless.
          }
        },
      },
    }
  )
}
