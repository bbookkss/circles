'use client'

import { useRef, useState, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// SF default center
const SF_CENTER = { longitude: -122.4194, latitude: 37.7749, zoom: 13 }

export type CirclePin = {
  id: string
  name: string
  description?: string | null
  latitude: number
  longitude: number
  category?: string | null
  memberCount?: number
}

type Props = {
  circles?: CirclePin[]
  onCircleClick?: (circle: CirclePin) => void
}

export default function CirclesMap({ circles = [], onCircleClick }: Props) {
  const [popupCircle, setPopupCircle] = useState<CirclePin | null>(null)

  const handleMarkerClick = useCallback((circle: CirclePin) => {
    setPopupCircle(circle)
    onCircleClick?.(circle)
  }, [onCircleClick])

  return (
    <Map
      initialViewState={SF_CENTER}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
      />

      {circles.map((circle) => (
        <Marker
          key={circle.id}
          longitude={circle.longitude}
          latitude={circle.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(circle)}
        >
          <button
            className="w-8 h-8 rounded-full bg-white border-2 border-black flex items-center justify-center text-xs font-bold shadow-lg hover:scale-110 transition-transform cursor-pointer"
            title={circle.name}
          >
            ●
          </button>
        </Marker>
      ))}

      {popupCircle && (
        <Popup
          longitude={popupCircle.longitude}
          latitude={popupCircle.latitude}
          anchor="bottom"
          onClose={() => setPopupCircle(null)}
          closeOnClick={false}
          className="rounded-lg"
        >
          <div className="p-1 min-w-[160px]">
            <p className="font-semibold text-sm">{popupCircle.name}</p>
            {popupCircle.category && (
              <p className="text-xs text-gray-500 mt-0.5">{popupCircle.category}</p>
            )}
            {popupCircle.description && (
              <p className="text-xs mt-1 text-gray-700 line-clamp-2">{popupCircle.description}</p>
            )}
            {popupCircle.memberCount !== undefined && (
              <p className="text-xs text-gray-400 mt-1">{popupCircle.memberCount} members</p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  )
}
