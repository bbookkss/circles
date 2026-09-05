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

export function extractFromFeature(feature: {
  text: string
  place_type: string[]
  context?: { id: string; text: string }[]
}): GeoResult {
  const neighborhoodText =
    feature.context?.find((c) => c.id?.startsWith('neighborhood'))?.text ??
    feature.context?.find((c) => c.id?.startsWith('locality'))?.text ??
    (feature.place_type?.[0] === 'neighborhood' ? feature.text : null)

  const city = feature.context?.find((c) => c.id?.startsWith('place'))?.text ?? null
  const neighborhood = neighborhoodText && city ? `${neighborhoodText}, ${city}` : neighborhoodText ?? city ?? null

  return { neighborhood, city }
}
