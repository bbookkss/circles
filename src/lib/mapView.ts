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
