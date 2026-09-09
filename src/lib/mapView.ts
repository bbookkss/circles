/**
 * Where the explore map should open.
 *
 * Order of preference: the circles you are already in, then the city your IP
 * suggests, then San Francisco. The first is the strongest signal and costs
 * nothing; the second is city-level and needs no permission prompt, so the map
 * renders in the right place rather than jumping there after a dialog. The
 * crosshair control on the map is still there when someone wants precision.
 */

export type MapView = { longitude: number; latitude: number; zoom: number }

export const SF_VIEW: MapView = { longitude: -122.4194, latitude: 37.7749, zoom: 12 }

/** Roughly how far apart two points are, in kilometres. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Middle value, or the lower of the two middles for an even count. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}

/**
 * A view over where most of these points are.
 *
 * Deliberately not a bounding box of all of them: one circle in another state
 * would otherwise zoom the map out to the whole country, which is worse than
 * the hardcoded city it replaced. The median point decides the centre, and
 * only points within a metro-sized radius of it set the zoom — anything
 * further out is left off screen, where "See everywhere" can still reach it.
 */
export function viewForPoints(
  points: { latitude: number; longitude: number }[],
  { clusterRadiusKm = 60, minZoom = 10, maxZoom = 14 } = {}
): MapView | null {
  if (points.length === 0) return null

  const centre = {
    latitude: median(points.map((p) => p.latitude)),
    longitude: median(points.map((p) => p.longitude)),
  }

  const near = points.filter((p) => distanceKm(centre, p) <= clusterRadiusKm)
  const cluster = near.length > 0 ? near : [centre]

  const lats = cluster.map((p) => p.latitude)
  const lngs = cluster.map((p) => p.longitude)
  const latitude = (Math.min(...lats) + Math.max(...lats)) / 2
  const longitude = (Math.min(...lngs) + Math.max(...lngs)) / 2

  // Longitude degrees shrink towards the poles, so weight them by latitude
  // before comparing the two spans.
  const spanLat = Math.max(...lats) - Math.min(...lats)
  const spanLng = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos((latitude * Math.PI) / 180)
  const span = Math.max(spanLat, spanLng)

  // One point, or several in the same spot: a neighbourhood-level view.
  if (span < 0.005) return { longitude, latitude, zoom: 13 }

  // 360 degrees spans the world at zoom 0, halving each level. The -0.5 leaves
  // a margin so the outermost pins are not flush against the edge.
  const zoom = Math.log2(360 / span) - 0.5
  return { longitude, latitude, zoom: Math.min(Math.max(zoom, minZoom), maxZoom) }
}


/** City-level position from an IP lookup. */
export type Geo = { latitude: number; longitude: number; city: string | null }

/**
 * Read a Geo out of request headers, or null if they are not there.
 *
 * Vercel's edge sets these; nothing sets them locally, so null is the normal
 * case under `npm run dev` rather than an error. Takes a getter rather than a
 * Headers object so it can be exercised without a request.
 */
export function geoFromHeaders(get: (name: string) => string | null): Geo | null {
  const latitude = Number(get('x-vercel-ip-latitude'))
  const longitude = Number(get('x-vercel-ip-longitude'))

  // A missing header reads as 0 through Number(), and null island is not a
  // place anyone is exploring circles from.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

  const raw = get('x-vercel-ip-city')
  let city: string | null = null
  if (raw) {
    // Percent-encoded at the edge ("San%20Francisco"). A malformed value is
    // not worth throwing a whole page over.
    try {
      city = decodeURIComponent(raw)
    } catch {
      city = raw
    }
  }

  return { latitude, longitude, city }
}

/**
 * Where the explore map should open, and what to call that place.
 *
 * `place` is only set when the IP lookup is what decided it — the name is used
 * in "No circles in X yet", and claiming a city when the view came from the
 * user's own circles would be guessing.
 */
export function resolveMapView(
  circlePoints: { latitude: number | null; longitude: number | null }[],
  geo: Geo | null
): { view: MapView; place: string | null } {
  const known = circlePoints.filter(
    (c): c is { latitude: number; longitude: number } =>
      typeof c.latitude === 'number' && typeof c.longitude === 'number'
  )

  const fromCircles = viewForPoints(known)
  if (fromCircles) return { view: fromCircles, place: null }

  if (geo) {
    return {
      view: { latitude: geo.latitude, longitude: geo.longitude, zoom: 11 },
      place: geo.city,
    }
  }

  return { view: SF_VIEW, place: null }
}
