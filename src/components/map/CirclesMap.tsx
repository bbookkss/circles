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
   *
   * `canShowAll` says whether that helper would actually do anything. There is
   * a difference between "nothing near here" and "nothing anywhere", and only
   * this component knows which it is. Offering a button that silently does
   * nothing is worse than not offering it, so callers are expected to hide the
   * control rather than let it no-op.
   */
  emptyOverlay?: (helpers: {
    showAll: () => void
    canShowAll: boolean
    areaName: string | null
  }) => ReactNode
  /**
   * A circle to fly to. Changing it moves the map; the same value twice does
   * nothing, so a list that re-renders does not keep yanking the view. Set by
   * the explore list so tapping a row shows where it is, which pilot users
   * assumed it already did.
   */
  focus?: CirclePin | null
}

export default function CirclesMap({
  circles = [],
  onCircleClick,
  initialView = SF_VIEW,
  emptyOverlay,
  focus = null,
}: Props) {
  // Both live in state rather than refs: the overlay is handed a helper that
  // closes over the map, and "is anything visible" is derived during render.
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [bounds, setBounds] = useState<LngLatBounds | null>(null)
  const [popupCircle, setPopupCircle] = useState<CirclePin | null>(null)
  const [areaName, setAreaName] = useState<string | null>(null)
  // The locate button fails silently by default: the icon just stops
  // spinning. Pilot users read that as "doesn't work". Keep the reason.
  const [locateError, setLocateError] = useState<string | null>(null)

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

  /**
   * Whether pulling back would reveal anything. False on an empty database,
   * which is the state every visitor sees before the first circle exists.
   */
  const canShowAll = circles.length > 0

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

  // Fly to whatever the caller focused. Never zoom *out* to do it: someone
  // already zoomed in on a neighbourhood should not be pulled back to city
  // level because they tapped a row.
  useEffect(() => {
    if (!map || !focus) return
    map.flyTo({
      center: [focus.longitude, focus.latitude],
      zoom: Math.max(map.getZoom(), 13),
      duration: 900,
      essential: true,
    })
    // Only the identity matters; the same circle re-selected should not move.
  }, [map, focus?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
        positionOptions={{ enableHighAccuracy: true, timeout: 10000 }}
        onGeolocate={() => setLocateError(null)}
        onError={(e) => {
          // PERMISSION_DENIED is 1, POSITION_UNAVAILABLE 2, TIMEOUT 3. The
          // first is by far the common one on phones, and the fix is in the
          // browser's site settings, not in this app, so say so.
          setLocateError(
            e.code === 1
              ? 'Location is blocked for this site. Allow it in your browser settings, then try again.'
              : e.code === 3
                ? 'Could not get a fix in time. Try again outdoors or with Wi-Fi on.'
                : 'Your device could not report a location.'
          )
        }}
      />
      {locateError && (
        <div className="absolute top-3 left-3 right-16 md:left-auto md:right-14 md:max-w-xs z-10 bg-background/95 backdrop-blur border rounded-lg px-3 py-2 text-xs shadow-lg flex items-start gap-2">
          <span className="flex-1">{locateError}</span>
          <button type="button" onClick={() => setLocateError(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">×</button>
        </div>
      )}

      {circles.map((circle) => (
        <Marker
          key={circle.id}
          longitude={circle.longitude}
          latitude={circle.latitude}
          anchor="bottom"
          onClick={() => handleMarkerClick(circle)}
        >
          {/* A paper name tag on a pin, which is what a notice board pin
              looks like, rather than an emoji in a disc. The name is the
              information; an emoji at 18px was not readable as anything. */}
          {/* A sharp pin on displaced coordinates would be a confident lie:
              it looks precise, and it is not. Approximate circles get the
              pen-blue treatment and a soft halo that says roughly here. */}
          {circle.approximate && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-20 h-20 rounded-full bg-pen/10 ring-1 ring-pen/30"
            />
          )}
          <span className="relative flex flex-col items-center cursor-pointer group">
            <button
              title={
                circle.approximate
                  ? `${circle.name} · approximate area`
                  : circle.kind === 'commercial'
                    ? `${circle.name} · business`
                    : circle.name
              }
              className={`font-display font-semibold text-[13px] leading-none whitespace-nowrap max-w-[240px] truncate rounded-full px-2.5 py-1.5 bg-background border shadow-[0_1px_3px_rgba(34,31,27,0.25)] transition-transform group-hover:-translate-y-0.5 ${
                circle.approximate
                  ? 'border-pen text-pen'
                  : circle.kind === 'commercial'
                    ? 'border-foreground ring-1 ring-foreground/30 text-foreground'
                    : 'border-foreground text-foreground'
              }`}
            >
              {circle.emoji ? `${circle.emoji} ` : ''}{circle.name}
            </button>
            <span aria-hidden className={`w-px h-2 ${circle.approximate ? 'bg-pen' : 'bg-foreground'}`} />
          </span>
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
            <p className="font-display font-semibold text-base leading-tight">
              {popupCircle.emoji && <span className="mr-1">{popupCircle.emoji}</span>}
              {popupCircle.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {popupCircle.category && (
                <span className="font-display italic text-xs text-pen">{popupCircle.category}</span>
              )}
              {popupCircle.kind === 'commercial' && (
                <span className="label">business</span>
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
          <div className="pointer-events-auto">{emptyOverlay({ showAll, canShowAll, areaName })}</div>
        </div>
      )}
    </Map>
  )
}
