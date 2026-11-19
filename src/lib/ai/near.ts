/**
 * A location the browser sent, after the person said yes to sharing it.
 *
 * Rounded to two decimal places (about 1 km) before anything uses it, so the
 * server never holds a precise position: it only sorts results by distance.
 * Nothing stores it. Anything malformed or out of range is ignored, and the
 * caller falls back to the rough city from the IP.
 */
export type Near = { latitude: number; longitude: number; city: null }

export function parseNear(raw: unknown): Near | null {
  if (!raw || typeof raw !== 'object') return null
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown }
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const r = (n: number) => Math.round(n * 100) / 100
  return { latitude: r(lat), longitude: r(lng), city: null }
}
