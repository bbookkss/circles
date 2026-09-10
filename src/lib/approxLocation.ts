/**
 * Coarse location for people who are not in a circle yet.
 *
 * A circle is a group that meets at a known place on a known schedule, which
 * is exactly the information needed to wait for someone. Members need the
 * address to turn up; nobody else does, so nobody else gets it.
 *
 * Three properties matter, and each rules out a tempting shortcut:
 *
 * 1. The precise point must never leave the server. Drawing a blur circle in
 *    the browser around real coordinates hides nothing: the numbers are in the
 *    page source. So this runs server-side and the exact figures are simply
 *    not sent.
 *
 * 2. The shown area must not be centred on the truth. A circle centred on the
 *    meeting place announces it in the middle — the blur becomes a target
 *    ring. The centre is therefore displaced, and the real point sits
 *    somewhere off-centre inside.
 *
 * 3. The displacement must be stable per circle. If it were random per
 *    request, anyone could reload a few dozen times and average the centres
 *    back to the true location. It is derived from the circle's id instead, so
 *    it is the same on every render and averaging reveals nothing.
 */

/** Radius of the shown area, in metres. About a quarter of a mile. */
export const BLUR_RADIUS_M = 640

/** How far the shown centre is displaced from the truth, in metres. */
const OFFSET_MIN_M = 180
const OFFSET_MAX_M = 380

const EARTH_M = 6_378_137

/**
 * FNV-1a. Not a security hash and does not need to be: it decides an offset,
 * it does not protect one. What it must be is stable and well spread, so the
 * same circle always lands the same way and neighbouring ids do not land
 * together.
 */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type ApproxArea = {
  /** Centre of the area to draw. Deliberately not the meeting place. */
  latitude: number
  longitude: number
  radiusM: number
}

/**
 * A stable area containing the point, whose centre is not the point.
 */
export function approxArea(
  latitude: number,
  longitude: number,
  seed: string
): ApproxArea {
  const h = hash(seed)

  // Two independent values out of the one hash: direction, and how far.
  const bearing = ((h & 0xffff) / 0x10000) * 2 * Math.PI
  const distance =
    OFFSET_MIN_M + (((h >>> 16) & 0xffff) / 0x10000) * (OFFSET_MAX_M - OFFSET_MIN_M)

  const dNorth = distance * Math.cos(bearing)
  const dEast = distance * Math.sin(bearing)

  // Metres to degrees. Longitude degrees shorten towards the poles, hence the
  // cos(latitude) term; without it the offset is wrong everywhere but the
  // equator, and wrong by a factor of two by the time you reach Scotland.
  const dLat = (dNorth / EARTH_M) * (180 / Math.PI)
  const dLng =
    (dEast / (EARTH_M * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI)

  return {
    latitude: latitude + dLat,
    longitude: longitude + dLng,
    radiusM: BLUR_RADIUS_M,
  }
}
