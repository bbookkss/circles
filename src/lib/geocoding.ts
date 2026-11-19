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
 * A place name to coordinates, for "take me to Oakland". Server-side only in
 * practice (the assistant's go_to_place tool), though the token is the same
 * public one the map uses.
 *
 * Towns, localities and neighbourhoods only: no addresses or points of
 * interest, so the assistant can move the map to an area but cannot be used
 * to look up a specific address.
 */
export async function forwardGeocode(name: string): Promise<Place | null> {
  const q = name.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80)
  if (!q || !MAPBOX_TOKEN) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=place,locality,neighborhood&limit=1&access_token=${MAPBOX_TOKEN}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const f = json.features?.[0]
    const [longitude, latitude] = (f?.center ?? []) as number[]
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    const isPlace = (f.place_type ?? []).includes('place')
    return {
      latitude,
      longitude,
      label: String(f.place_name ?? f.text ?? q).slice(0, 80),
      zoom: isPlace ? 11.5 : 13,
    }
  } catch {
    return null
  }
}
