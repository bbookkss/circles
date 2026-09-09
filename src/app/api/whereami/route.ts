import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { geoFromHeaders, resolveMapView } from '@/lib/mapView'

/**
 * TEMPORARY diagnostic: what does Vercel's edge actually send?
 *
 * The explore map falls back to IP-derived location, but the header names come
 * from Vercel's docs and cannot be verified locally or from a unit test — a
 * mock only ever agrees with itself. This reports what arrives in a real
 * request so that question can be settled, and should be deleted once it is.
 *
 * Signed-in only. It reveals the caller's own approximate location to
 * themselves and nothing else, but there is no reason to serve it publicly.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const h = await headers()
  const geo = geoFromHeaders((name) => h.get(name))

  return NextResponse.json({
    rawHeaders: {
      'x-vercel-ip-latitude': h.get('x-vercel-ip-latitude'),
      'x-vercel-ip-longitude': h.get('x-vercel-ip-longitude'),
      'x-vercel-ip-city': h.get('x-vercel-ip-city'),
      'x-vercel-ip-country': h.get('x-vercel-ip-country'),
      'x-vercel-ip-country-region': h.get('x-vercel-ip-country-region'),
    },
    // Every x-vercel-* header present, in case the names have changed.
    allVercelHeaders: Object.fromEntries(
      [...h.entries()].filter(([k]) => k.startsWith('x-vercel-'))
    ),
    parsedGeo: geo,
    // What explore would do for someone with no circles of their own.
    viewIfYouHadNoCircles: resolveMapView([], geo),
  })
}
