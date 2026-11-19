/**
 * The Circles account: the profile that owns listed public events
 * (supabase/listings-account-2026-11-18.sql). Anywhere it appears by name,
 * the name carries the official badge, so people can tell a listing from a
 * circle a neighbour started. Nobody can sign in as it, so the badge can't
 * be borrowed by posting from it.
 */
export const OFFICIAL_ID = 'c1c1e5c1-0000-4000-8000-00000000c1c1'

export const isOfficial = (id: string | null | undefined) => id === OFFICIAL_ID
