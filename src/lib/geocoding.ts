const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality&access_token=${MAPBOX_TOKEN}`
  )
  const json = await res.json()
  const feature = json.features?.[0]
  if (!feature) return null

  const neighborhood = feature.text
  const city = feature.context?.find((c: { id: string; text: string }) => c.id?.startsWith('place'))?.text

  if (neighborhood && city) return `${neighborhood}, ${city}`
  return neighborhood ?? city ?? null
}

export function extractNeighborhoodFromFeature(feature: {
  text: string
  place_type: string[]
  context?: { id: string; text: string }[]
}): string | null {
  const neighborhoodText =
    feature.context?.find((c) => c.id?.startsWith('neighborhood'))?.text ??
    feature.context?.find((c) => c.id?.startsWith('locality'))?.text ??
    (feature.place_type?.[0] === 'neighborhood' ? feature.text : null)

  const city = feature.context?.find((c) => c.id?.startsWith('place'))?.text

  if (neighborhoodText && city) return `${neighborhoodText}, ${city}`
  return neighborhoodText ?? city ?? null
}
