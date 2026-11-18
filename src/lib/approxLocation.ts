/**
 * Coarse location for people who are not in a circle yet.
 *
 * A circle is a group that meets at a known place on a known schedule, which
 * is exactly the information needed to wait for someone. Members need the
 * address to turn up; nobody else does, so nobody else gets it.
 *
 * The blur lives in the database, not here. supabase/location-privacy-
 * 2026-11-18.sql stores a shown centre (area_latitude, area_longitude) for
 * every circle, displaced from the real point by an offset drawn at random
 * once and kept. Non-members can read only that. Members read the point
 * and the venue name through circle_places(), which checks membership.
 *
 * Three properties matter, and each rules out a tempting shortcut:
 *
 * 1. The precise point must never leave the server. Drawing a blur in the
 *    browser around real coordinates hides nothing: the numbers are in the
 *    page source. Blurring on the Next server was not enough either, because
 *    the anon key ships in every page and PostgREST would hand the columns to
 *    anyone who asked. So the columns themselves are withheld.
 *
 * 2. The shown area must not be centred on the truth, or the blur becomes a
 *    target ring. The offset is 300-700m, inside a 1100m radius.
 *
 * 3. The offset must be stable and secret. Stable, or reloading and
 *    averaging recovers the point. Secret, or subtracting it does. The first
 *    version derived it from a hash of the circle's id: stable, but the id is
 *    in every URL and the hash was in this file, so the offset was public.
 *    A stored random offset is both.
 */

/**
 * Radius of the shown area, in metres. About two thirds of a mile.
 *
 * The first version used 640m and still read as a specific spot: a quarter
 * mile is one or two blocks, which narrows a search rather than widening it.
 * At this size the disc covers a neighbourhood, which is the intent — enough
 * to know whether a circle is near you, not enough to stand and wait.
 */
export const BLUR_RADIUS_M = 1100

/** The exact point and venue name, as circle_places() returns them to members. */
export type CirclePlace = {
  circle_id: string
  latitude: number | null
  longitude: number | null
  location: string | null
}
