'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import type { Map as MapboxMap, LngLatBounds } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { installCoffeeTheme, COFFEE } from '@/lib/mapTheme'
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
  /**
   * Fired with the device's position when the locate control gets a fix.
   * The explore page uses it to re-sort its list by real distance instead of
   * the city-level IP guess it starts with.
   */
  onLocate?: (position: { latitude: number; longitude: number }) => void
  /**
   * The selection is over. Fired when the map is tapped away from any pin,
   * and when the selected circle is panned out of view. The map clears its
   * own tag either way; this is so the caller can drop its card too, which
   * otherwise sat under the empty-state overlay saying two things at once.
   */
  onDeselect?: () => void
}

export default function CirclesMap({
  circles = [],
  onCircleClick,
  initialView = SF_VIEW,
  emptyOverlay,
  focus = null,
  onLocate,
  onDeselect,
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
    // Second tap on the open tag folds it; a tap on another one swaps.
    setPopupCircle((prev) => (prev?.id === circle.id ? null : circle))
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
    // Arriving from the list opens the tag too, so the fly-to lands on
    // something readable rather than a pin you then have to tap.
    setPopupCircle(focus)
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
      // The canvas is this colour before any tile arrives, so the first
      // frame is paper, not the stock white that used to flash.
      style={{ width: '100%', height: '100%', background: COFFEE }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={(e) => {
        installCoffeeTheme(e.target)
        setMap(e.target)
        setBounds(e.target.getBounds())
      }}
      onMoveEnd={(e) => {
        const b = e.target.getBounds()
        setBounds(b)
        // A selection you have panned away from is not a selection any more.
        // Otherwise the card for something off-screen sat under the
        // "No circles here yet" overlay, saying two things at once.
        if (popupCircle && b && !b.contains([popupCircle.longitude, popupCircle.latitude])) {
          setPopupCircle(null)
          onDeselect?.()
        }
      }}
      // Tapping the map away from any pin folds the tag and clears the
      // selection. Pin clicks stop propagation, so they never land here.
      onClick={() => {
        setPopupCircle(null)
        onDeselect?.()
      }}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
        positionOptions={{ enableHighAccuracy: true, timeout: 10000 }}
        onGeolocate={(e) => {
          setLocateError(null)
          onLocate?.({ latitude: e.coords.latitude, longitude: e.coords.longitude })
        }}
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
          onClick={(e) => {
            // Markers live inside the map's canvas container, so this click
            // would bubble to the map's own onClick, which folds the card.
            // Open-then-immediately-close looked like a broken animation.
            e.originalEvent.stopPropagation()
            handleMarkerClick(circle)
          }}
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
          {/* The tag is the card. Tapping it does not swap it for a different
              popup; it grows downward, same paper, same ink edge, to show a
              line or two, then an Open link. The grid-rows trick animates
              height without knowing it in advance. Deselected, it folds back
              into a tag. */}
          {(() => {
            const open = popupCircle?.id === circle.id
            const edge = circle.approximate
              ? 'border-pen text-pen'
              : circle.kind === 'commercial'
                ? 'border-foreground ring-1 ring-foreground/30 text-foreground'
                : 'border-foreground text-foreground'
            return (
              <span className={`relative flex flex-col items-center cursor-pointer group ${open ? 'z-20' : ''}`}>
                <div
                  className={`bg-background border shadow-[0_1px_3px_rgba(34,31,27,0.25)] transition-[border-radius,transform] duration-300 ease-out ${edge} ${
                    open ? 'rounded-2xl w-[240px]' : 'rounded-full group-hover:-translate-y-0.5'
                  }`}
                >
                  <button
                    type="button"
                    title={
                      circle.approximate
                        ? `${circle.name} · approximate area`
                        : circle.kind === 'commercial'
                          ? `${circle.name} · business`
                          : circle.name
                    }
                    className={`block w-full text-left font-display font-semibold leading-none whitespace-nowrap truncate px-2.5 py-1.5 transition-[font-size] duration-300 ${
                      open ? 'text-[15px] px-3.5 pt-3 pb-1' : 'text-[13px] max-w-[240px]'
                    }`}
                  >
                    {circle.emoji ? `${circle.emoji} ` : ''}{circle.name}
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3.5 pb-3 space-y-1.5 text-foreground">
                        {(circle.category || circle.kind === 'commercial') && (
                          <p className="font-display italic text-sm text-pen leading-tight">
                            {[circle.category, circle.kind === 'commercial' ? 'business' : null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {circle.description && (
                          <p className="text-xs leading-snug text-foreground/80 line-clamp-2">{circle.description}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="label">
                            {circle.memberCount !== undefined ? `${circle.memberCount} member${circle.memberCount !== 1 ? 's' : ''}` : ''}
                            {circle.approximate ? (circle.memberCount !== undefined ? ' · ' : '') + 'approx. area' : ''}
                          </span>
                          <Link
                            href={`/circles/${circle.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-sans font-medium text-xs rounded-full border border-foreground px-3 py-1 hover:bg-pen hover:border-pen hover:text-white transition-colors"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <span aria-hidden className={`w-px h-2 ${circle.approximate ? 'bg-pen' : 'bg-foreground'}`} />
              </span>
            )
          })()}
        </Marker>
      ))}

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
