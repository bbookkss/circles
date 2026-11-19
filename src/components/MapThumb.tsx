/**
 * A small static map for a circle mentioned by Ask Circles.
 *
 * `exact` is only true for circles the person belongs to, where the point
 * came from circle_places(). Those get a pin. Every other circle is drawn
 * from its shown area (area_latitude/area_longitude, already displaced in the
 * database), zoomed out a step, with no pin, so a thumbnail never looks more
 * precise than the data behind it.
 */
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export default function MapThumb({ lat, lng, exact, label }: { lat: number; lng: number; exact: boolean; label: string }) {
  if (!TOKEN || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return <div className="w-16 h-14 shrink-0 rounded-md bg-muted" aria-hidden="true" />
  }
  const x = lng.toFixed(5)
  const y = lat.toFixed(5)
  const overlay = exact ? `pin-s+2b5c8a(${x},${y})/` : ''
  const zoom = exact ? 14 : 12.5
  const src = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}${x},${y},${zoom},0/128x112@2x?attribution=false&logo=false&access_token=${TOKEN}`
  return (
    <span className="relative w-16 h-14 shrink-0 rounded-md overflow-hidden bg-muted block">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static map image, not worth the image optimiser */}
      <img
        src={src}
        alt={exact ? `Map of where ${label} meets` : `Map of the area around ${label}`}
        width={64}
        height={56}
        loading="lazy"
        className="w-full h-full object-cover"
      />
      {!exact && (
        <span aria-hidden="true" className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-pen/20 border border-pen/50" />
      )}
    </span>
  )
}
