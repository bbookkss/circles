'use client'

import { useMemo } from 'react'
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { applyCoffeeTheme } from '@/lib/mapTheme'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

/**
 * A small, static-feeling map showing where a circle meets.
 *
 * Two modes, decided on the server and passed in already resolved:
 *
 *   exact  a pin. Members are going there, so they get the place.
 *   area   a shaded disc. Everyone else sees roughly where, never precisely.
 *
 * The caller must pass already-blurred coordinates for the area mode. This
 * component cannot protect anything on its own: whatever reaches it reaches
 * the browser, and a shaded circle drawn over real coordinates hides nothing
 * from anyone who opens the page source.
 *
 * Scroll-zoom is off so it never hijacks page scrolling on mobile.
 */
export default function CircleLocationMap({
  longitude,
  latitude,
  emoji,
  radiusM,
}: {
  longitude: number
  latitude: number
  emoji?: string | null
  /** When set, draw this radius as an area instead of a pin. */
  radiusM?: number
}) {
  // A circle as a polygon, since Mapbox has no circle geometry. 64 sides is
  // indistinguishable from round at this size.
  const areaGeoJson = useMemo(() => {
    if (!radiusM) return null
    const points: [number, number][] = []
    const latRad = (latitude * Math.PI) / 180
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * 2 * Math.PI
      // Same metres-to-degrees conversion as the server-side blur: longitude
      // degrees shorten towards the poles, so east-west needs cos(latitude) or
      // the disc comes out as an ellipse everywhere but the equator.
      const dLat = ((radiusM * Math.cos(angle)) / 6_378_137) * (180 / Math.PI)
      const dLng =
        ((radiusM * Math.sin(angle)) / (6_378_137 * Math.cos(latRad))) * (180 / Math.PI)
      points.push([longitude + dLng, latitude + dLat])
    }
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [points] },
    }
  }, [longitude, latitude, radiusM])

  return (
    <Map
      initialViewState={{
        longitude,
        latitude,
        // Pull back for an area, so the disc reads as a neighbourhood rather
        // than filling the frame and implying more precision than it has.
        zoom: radiusM ? 13 : 14,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={(e) => applyCoffeeTheme(e.target)}
      scrollZoom={false}
      dragRotate={false}
      attributionControl={false}
    >
      {areaGeoJson ? (
        <Source id="approx-area" type="geojson" data={areaGeoJson}>
          <Layer
            id="approx-area-fill"
            type="fill"
            paint={{ 'fill-color': '#3a2a23', 'fill-opacity': 0.13 }}
          />
          <Layer
            id="approx-area-line"
            type="line"
            paint={{ 'line-color': '#3a2a23', 'line-opacity': 0.35, 'line-width': 1.5 }}
          />
        </Source>
      ) : (
        <Marker longitude={longitude} latitude={latitude} anchor="center">
          {/* Matches the pin on the explore map: paper fill, ink edge. */}
          <div className="w-9 h-9 rounded-full bg-background border border-foreground/30 shadow-[0_1px_4px_rgba(58,42,35,0.28)] flex items-center justify-center text-lg">
            {emoji ?? '●'}
          </div>
        </Marker>
      )}
    </Map>
  )
}
