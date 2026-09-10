'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { Map as MapboxMap, LngLatBounds } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { applyCoffeeTheme } from '@/lib/mapTheme'
import { SF_VIEW, type MapView } from '@/lib/mapView'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export type CirclePin = {
  id: string
  name: string
  description?: string | null
  latitude: number
  longitude: number
  category?: string | null
  emoji?: string | null
  memberCount?: number
  kind?: string | null
  /** Coordinates are a coarse area, not the meeting place. */
  approximate?: boolean
}

type Props = {
  circles?: CirclePin[]
  onCircleClick?: (circle: CirclePin) => void
  /** Where to open. Defaults to San Francisco when the caller has no better idea. */
  initialView?: MapView
  /**
   * Shown over the map whenever no pin falls inside the visible area. Given a
   * `showAll` helper, because escaping an empty area needs the map instance
   * and only this component has one, and `areaName` for wherever the map is
   * currently looking — null while unknown, so callers can fall back to
   * something that is true regardless.
   */
  emptyOverlay?: (helpers: { showAll: () => void; areaName: string | null }) => ReactNode
}

export default function CirclesMap({
  circles = [],
  onCircleClick,
  initialView = SF_VIEW,
  emptyOverlay,
}: Props) {
  // Both live in state rather than refs: the overlay is handed a helper that
  // closes over the map, and "is anything visible" is derived during render.
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [bounds, setBounds] = useState<LngLatBounds | null>(null)
  const [popupCircle, setPopupCircle] = useState<CirclePin | null>(null)
  const [areaName, setAreaName] = useState<string | null>(null)

  const handleMarkerClick = useCallback((circle: CirclePin) => {
    setPopupCircle(circle)
    onCircleClick?.(circle)
  }, [onCircleClick])

  // Derived from the latest bounds rather than stored, so it answers correctly
  // both when the map is panned away from the pins and when the pins
  // themselves change underneath it, e.g. a filter clearing.
  const nothingInView =
    !!emptyOverlay &&
    bounds !== null &&
    !circles.some((c) => bounds.contains([c.longitude, c.latitude]))

  /**
   * Name whatever is on screen now.
   *
   * The explore page used to label this with a place derived from the
   * visitor's IP once, on the server. That is wrong twice over: it names
   * where the *visitor* is rather than where the *map* is, and being a prop
   * it can never change, so panning from Palm Springs to Sacramento still
   * read "no circles in Desert Hot Springs". Worse when a VPN puts the IP in
   * a city the person has never been to.
   *
   * Reverse geocoding the centre fixes both, and is only run while the empty
   * state is actually showing and after movement has settled, so panning
   * around a populated map costs nothing.
   */
  useEffect(() => {
    if (!nothingInView || !map) {
      setAreaName(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const c = map.getCenter()
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${c.lng}` +
            `&latitude=${c.lat}&types=place&limit=1&access_token=${MAPBOX_TOKEN}`
        )
        if (!res.ok) return
        const json = await res.json()
        const name = json?.features?.[0]?.properties?.name
        if (!cancelled && typeof name === 'string') setAreaName(name)
      } catch {
        // Offline, rate limited, or mid-ocean. The overlay reads fine without
        // a name, so failing quietly is the right behaviour here.
      }
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // bounds is the dependency that matters: it changes on every settled move.
  }, [nothingInView, map, bounds])

  /** Pull back until every circle is on screen, wherever they are. */
  const showAll = useCallback(() => {
    if (!map || circles.length === 0) return
    const lats = circles.map((c) => c.latitude)
    const lngs = circles.map((c) => c.longitude)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, duration: 1400, maxZoom: 13 }
    )
  }, [circles, map])

  return (
    <Map
      initialViewState={initialView}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={(e) => {
        applyCoffeeTheme(e.target)
        setMap(e.target)
        setBounds(e.target.getBounds())
      }}
      onMoveEnd={(e) => setBounds(e.target.getBounds())}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl position="top-right" trackUserLocation showUserHeading />

      {circles.map((circle) => (
        <Marker
          key={circle.id}
          longitude={circle.longitude}
          latitude={circle.latitude}
          anchor="center"
          onClick={() => handleMarkerClick(circle)}
        >
          {/* Paper disc with an ink edge, not a white puck with a drop
              shadow. bg-card was lighter than anything else on screen and
              border-card made the ring the same colour as the fill, so the
              pins read as generic pasted-on circles rather than part of this
              map. The shadow is small and warm for the same reason: on a
              muted tan basemap a large neutral one just looks grey. */}
          {/* A sharp pin on displaced coordinates would be a confident lie:
              it looks precise, and it is not. The halo says roughly here. */}
          {circle.approximate && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-foreground/10 ring-1 ring-foreground/15"
            />
          )}
          <button
            title={
              circle.approximate
                ? `${circle.name} · approximate area`
                : circle.kind === 'commercial'
                  ? `${circle.name} · business`
                  : circle.name
            }
            className={`relative w-9 h-9 rounded-full bg-background flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110 shadow-[0_1px_4px_rgba(58,42,35,0.28)] border ${
              // Businesses get a heavier ring rather than an off-palette
              // amber, so they stand out without introducing a new colour.
              circle.kind === 'commercial'
                ? 'border-foreground/70 ring-1 ring-foreground/25'
                : 'border-foreground/30'
            }`}
          >
            {circle.emoji ?? '●'}
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
        >
          <div className="p-1 min-w-[160px]">
            <p className="font-semibold text-sm">
              {popupCircle.emoji && <span className="mr-1">{popupCircle.emoji}</span>}
              {popupCircle.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {popupCircle.category && (
                <span className="text-xs text-muted-foreground">{popupCircle.category}</span>
              )}
              {popupCircle.kind === 'commercial' && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                  Business
                </span>
              )}
            </div>
            {popupCircle.description && (
              <p className="text-xs mt-1 text-foreground/80 line-clamp-2">{popupCircle.description}</p>
            )}
            {popupCircle.memberCount !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">{popupCircle.memberCount} members</p>
            )}
          </div>
        </Popup>
      )}

      {/* Bottom, not centre: dead centre is exactly where someone is looking
          and dragging, so it covered the map and followed them around. */}
      {emptyOverlay && nothingInView && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">{emptyOverlay({ showAll, areaName })}</div>
        </div>
      )}
    </Map>
  )
}
