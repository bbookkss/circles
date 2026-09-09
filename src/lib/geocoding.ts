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
