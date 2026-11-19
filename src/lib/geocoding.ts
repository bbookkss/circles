const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export type GeoResult = {
  neighborhood: string | null
  city: string | null
}

export async function reverseGeocode(lng: number, lat: number): Promise<GeoResult> {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality&access_token=${MAPBOX_TOKEN}`
  )
  const json = await res.json()
  const feature = json.features?.[0]
  if (!feature) return { neighborhood: null, city: null }

  const neighborhoodText = feature.text ?? null
  const city = feature.context?.find((c: { id: string; text: string }) => c.id?.startsWith('place'))?.text ?? null
  const neighborhood = neighborhoodText && city ? `${neighborhoodText}, ${city}` : neighborhoodText ?? city ?? null

  return { neighborhood, city }
}

/**
 * Pull neighbourhood and city out of a Search Box feature.
 *
 * Note the shape differs from the Geocoding API: v5 returns `context` as an
 * array of {id, text} where the id carries the type, Search Box returns an
 * object keyed by type. Same information, different envelope.
 */
export function extractFromSearchBox(feature: {
  properties?: {
    context?: {
      neighborhood?: { name?: string }
      locality?: { name?: string }
      place?: { name?: string }
    }
  }
}): GeoResult {
  const ctx = feature.properties?.context ?? {}
  const neighborhoodText = ctx.neighborhood?.name ?? ctx.locality?.name ?? null
  const city = ctx.place?.name ?? null
  const neighborhood =
    neighborhoodText && city ? `${neighborhoodText}, ${city}` : neighborhoodText ?? city ?? null

  return { neighborhood, city }
}

export type Place = { latitude: number; longitude: number; label: string; zoom: number }

/**
 * A place name to coordinates, for "take me to Oakland" and "circles near the
 * Mission". Called on the server (the assistant's tools).
 *
 * The public Mapbox token can't do this: it is restricted to the site's own
 * web pages, and a server request carries no page, so Mapbox refuses it. That
 * silently broke every place lookup the assistant made. So: a server-only
 * token when MAPBOX_SERVER_TOKEN is set, otherwise OpenStreetMap's Nominatim,
 * which asks for an identifying User-Agent and light use. Lookups are cached
 * for the life of the server instance.
 *
 * Areas only (cities, towns, neighbourhoods): no street addresses, so this
 * can move a map or centre a search but can't be used to look up where
 * someone lives.
 */
const placeCache = new Map<string, Place | null>()

export async function forwardGeocode(name: string): Promise<Place | null> {
  const q = name.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80)
  if (!q) return null
  const key = q.toLowerCase()
  if (placeCache.has(key)) return placeCache.get(key)!
  const found = (await viaMapbox(q)) ?? (await viaNominatim(q))
  if (placeCache.size > 500) placeCache.clear()
  placeCache.set(key, found)
  return found
}

async function viaMapbox(q: string): Promise<Place | null> {
  const token = process.env.MAPBOX_SERVER_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=place,locality,neighborhood&limit=1&access_token=${token}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const f = (await res.json()).features?.[0]
    const [longitude, latitude] = (f?.center ?? []) as number[]
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return {
      latitude,
      longitude,
      label: String(f.place_name ?? f.text ?? q).slice(0, 80),
      zoom: (f.place_type ?? []).includes('place') ? 11.5 : 13,
    }
  } catch {
    return null
  }
}

// Neighbourhood-level kinds Nominatim may return. Anything else (a street, a
// building, a shop) is refused, so this never resolves an address.
const AREA_KINDS = new Set(['city', 'town', 'village', 'municipality', 'suburb', 'neighbourhood', 'quarter', 'city_district', 'borough'])

async function viaNominatim(q: string): Promise<Place | null> {
  const get = async (extra: string) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3${extra}&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'Circles (hicircles.com)' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { addresstype?: string; type?: string }[]
    return rows.find((r) => AREA_KINDS.has(String(r.addresstype ?? r.type))) ?? null
  }
  try {
    // Towns and cities first; then neighbourhoods like SoMa, which Nominatim
    // doesn't file as settlements.
    const f = ((await get('&featureType=settlement')) ?? (await get(''))) as Record<string, unknown> | null
    const latitude = Number(f?.lat)
    const longitude = Number(f?.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    const city = ['city', 'town', 'village', 'municipality'].includes(String(f!.addresstype ?? f!.type))
    return { latitude, longitude, label: String(f!.name || f!.display_name || q).slice(0, 80), zoom: city ? 11.5 : 13 }
  } catch {
    return null
  }
}
