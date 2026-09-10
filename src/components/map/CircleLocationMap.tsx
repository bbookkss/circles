'use client'

import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { applyCoffeeTheme } from '@/lib/mapTheme'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// A small, static-feeling map that shows a single circle's location.
// Scroll-zoom is disabled so it never hijacks page scrolling on mobile.
export default function CircleLocationMap({
  longitude,
  latitude,
  emoji,
}: {
  longitude: number
  latitude: number
  emoji?: string | null
}) {
  return (
    <Map
      initialViewState={{ longitude, latitude, zoom: 14 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={(e) => applyCoffeeTheme(e.target)}
      scrollZoom={false}
      dragRotate={false}
      attributionControl={false}
    >
      <Marker longitude={longitude} latitude={latitude} anchor="center">
        {/* Matches the pin on the explore map: paper fill, ink edge. */}
        <div className="w-9 h-9 rounded-full bg-background border border-foreground/30 shadow-[0_1px_4px_rgba(58,42,35,0.28)] flex items-center justify-center text-lg">
          {emoji ?? '●'}
        </div>
      </Marker>
    </Map>
  )
}
