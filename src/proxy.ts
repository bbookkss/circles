import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims, not getUser. getUser posts to /auth/v1/user on every single
  // request -- 130-180ms, on every page including static ones, which is why an
  // empty /login cost as much as a data-heavy /home. getClaims verifies the
  // token's signature locally against the project's ES256 public key, which is
  // cached module-wide (GLOBAL_JWKS) and so survives across the per-request
  // clients Next.js creates.
  //
  // The session refresh is preserved: getClaims calls getSession() first, and
  // that is what rotates an expiring token and writes the new cookies onto
  // supabaseResponse via setAll. Losing that would silently log people out.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims ? { id: claimsData.claims.sub } : null

  // Any response we return INSTEAD of supabaseResponse has to carry those
  // cookies over. Miss this and a refresh silently logs the user out: the
  // server rotates the refresh token, the browser never receives the new one,
  // and the old one is already invalid.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  const isPublicRoute =
    // The landing page has to be readable by someone who has never heard of
    // this, which is the entire point of having one.
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/check-email') ||
    // Reached while signed out, by definition.
    pathname.startsWith('/forgot-password') ||
    // Circle detail pages are publicly viewable (page handles the unauthed state)
    /^\/circles\/[^/]+$/.test(pathname)

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicRoute) {
    return redirectTo('/login')
  }

  // Redirect authenticated users away from login/signup
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return redirectTo('/home')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
