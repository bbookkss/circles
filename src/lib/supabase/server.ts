import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // Called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}

export type AuthUser = { id: string; email: string | null }

/**
 * The signed-in user, taken from the access token's claims.
 *
 * Prefer this to `auth.getUser()`, which POSTs to /auth/v1/user and costs a
 * 130-180ms round trip every time it is called -- and it was being called
 * three times per page render: once in proxy.ts, once in the page, once in
 * TopNav. getClaims verifies the token signature locally against the project's
 * ES256 public key, cached module-wide by auth-js.
 *
 * The security difference is worth stating plainly: getUser asks the auth
 * server, so it notices a session revoked before its token expired; this does
 * not, within the token's lifetime. That is acceptable here because RLS is the
 * real boundary and Postgres trusts the same signed JWT regardless -- an
 * app-level getUser never protected a revoked-but-unexpired token from
 * reaching the database.
 */
export async function getAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return {
    id: claims.sub as string,
    email: (claims.email as string | undefined) ?? null,
  }
}
