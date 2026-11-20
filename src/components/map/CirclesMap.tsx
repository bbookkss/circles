'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Map, { Marker, NavigationControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox'
import type { Map as MapboxMap, LngLatBounds } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { installMapTheme, MAP_BG } from '@/lib/mapTheme'
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
  /** true free, false costs something, null/undefined not said. */
  is_free?: boolean | null
  /** "$7 cover" and the like, shown with the paid mark. */
  price_note?: string | null
}

/** Hex like #f2a531 to an rgba() string Mapbox paint properties accept. */
function rgba(hex: string, a: number) {
  const h = hex.replace('#', '').trim()
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  if (Number.isNaN(n)) return `rgba(242,165,49,${a})`
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

/** Heat weight: bigger circles burn a little hotter, but even a new one glows. */
function heatWeight(members: number | undefined) {
  return 0.35 + 0.65 * Math.min(1, Math.log1p(members ?? 0) / Math.log(60))
}

/** Metres between two points, near enough for "is this the same spot". */
function metres(a: CirclePin, b: CirclePin) {
  const k = 111_320
  const dx = (a.longitude - b.longitude) * k * Math.cos((a.latitude * Math.PI) / 180)
  const dy = (a.latitude - b.latitude) * k
  return Math.hypot(dx, dy)
}

type Group = { key: string; anchor: CirclePin; members: CirclePin[]; samePlace: boolean }

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
  // Bumped on every camera move so grouping is recomputed against the pixels
  // the tags actually occupy now.
  const [viewTick, setViewTick] = useState(0)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  // The street-label layer the heat goes under, so names stay readable.
  const [labelLayer, setLabelLayer] = useState<string | undefined>(undefined)
  // Mapbox paint needs real colours, not CSS variables: read the theme's heat
  // and re-read it when light/dark flips.
  const [heat, setHeat] = useState('#f2a531')
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--heat').trim()
      if (v) setHeat(v)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  /**
   * Heat for every circle, members' included. Exact points for circles you're
   * in, the displaced area for the rest: the same coordinates the tags use, so
   * the glow never says more than the data does.
   */
  const heatData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: circles.map((c) => ({
      type: 'Feature' as const,
      properties: { w: heatWeight(c.memberCount) },
      geometry: { type: 'Point' as const, coordinates: [c.longitude, c.latitude] },
    })),
  }), [circles])

  /**
   * Tags that would overlap on screen merge into one "N circles" marker. Four
   * classes in the same rooftop park used to stack exactly, so only the top
   * one could ever be seen or tapped. Greedy in pixel space, biggest circle
   * first, recomputed as the camera moves. The selected circle is never
   * grouped: it is what the person is looking at.
   */
  const groups = useMemo<Group[]>(() => {
    if (!map) return circles.map((c) => ({ key: c.id, anchor: c, members: [c], samePlace: true }))
    // Each tag's on-screen box, from the text it will show: about 7px a
    // character plus the emoji and padding, capped where the tag clips its
    // name. A fixed width let long names overlap without ever merging.
    const tagWidth = (c: CirclePin) => Math.min(214, 7.2 * c.name.length + (c.emoji ? 26 : 10) + 22 + (c.is_free === false ? 22 : 0))
    const GROUP_W = 118
    const H = 30
    const GAP = 6
    type Placed = Group & { x: number; y: number; w: number }
    const overlaps = (a: Placed, x: number, y: number, w: number) =>
      Math.abs(a.x - x) < (a.w + w) / 2 + GAP && Math.abs(a.y - y) < H + GAP
    const order = [...circles].sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
    const out: Placed[] = []
    for (const c of order) {
      const p = map.project([c.longitude, c.latitude])
      const w = tagWidth(c)
      if (c.id !== popupCircle?.id) {
        const hit = out.find((g) => g.anchor.id !== popupCircle?.id && overlaps(g, p.x, p.y, w))
        if (hit) {
          hit.members.push(c)
          hit.w = GROUP_W // it now shows as an "N circles" badge
          continue
        }
      }
      out.push({ key: c.id, anchor: c, members: [c], samePlace: true, x: p.x, y: p.y, w })
    }
    return out.map((g) => ({
      anchor: g.anchor,
      members: g.members,
      key: g.members.length > 1 ? 'g:' + g.members.map((m) => m.id).sort().join(',') : g.key,
      samePlace: g.members.every((m) => metres(m, g.anchor) < 40),
    }))
  }, [circles, map, viewTick, popupCircle?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Open a group: same spot shows a list; nearby spots zoom in to split. */
  const openGroupAt = useCallback((g: Group) => {
    if (!map) return
    if (g.samePlace || map.getZoom() >= 17) {
      setOpenGroup((k) => (k === g.key ? null : g.key))
      return
    }
    const lats = g.members.map((m) => m.latitude)
    const lngs = g.members.map((m) => m.longitude)
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 140, duration: 700, maxZoom: 17 })
  }, [map])

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears a name fetched for a previous empty view
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens the tag in step with the fly-to
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
      style={{ width: '100%', height: '100%', background: MAP_BG }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={(e) => {
        installMapTheme(e.target)
        setMap(e.target)
        setBounds(e.target.getBounds())
        setLabelLayer(e.target.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id)
      }}
      onMoveEnd={(e) => {
        // Regroup tags once the camera settles, not on every frame: on a phone
        // a fingertip's jitter moved the map, regrouped the markers and swapped
        // the very element being tapped, so taps were lost.
        setViewTick((t) => t + 1)
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
      onClick={(e) => {
        // On touch, Mapbox fires its own map tap separately from the marker's
        // click, so stopPropagation on the marker doesn't stop it, and the map
        // closed what the marker had just opened. Ignore taps that landed on a
        // marker.
        const target = e.originalEvent?.target as HTMLElement | null
        if (target?.closest?.('.mapboxgl-marker')) return
        setPopupCircle(null)
        setOpenGroup(null)
        onDeselect?.()
      }}
    >
      {/* The heat: under the street names, over everything else. Radius grows
          with zoom so it reads as a neighbourhood from afar and a block up
          close. */}
      <Source id="circles-heat" type="geojson" data={heatData}>
        <Layer
          id="circles-heat"
          type="heatmap"
          beforeId={labelLayer}
          paint={{
            'heatmap-weight': ['get', 'w'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 1.1, 16, 1.6],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 14, 12, 34, 14, 60, 16, 110],
            'heatmap-opacity': 0.8,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.15, rgba(heat, 0.18),
              0.4, rgba(heat, 0.38),
              0.7, rgba(heat, 0.6),
              1, rgba(heat, 0.82),
            ],
          }}
        />
      </Source>
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
        <div className="absolute top-3 left-3 right-16 md:left-auto md:right-14 md:max-w-xs z-10 glass rounded-2xl px-3 py-2 text-xs shadow-lg flex items-start gap-2">
          <span className="flex-1">{locateError}</span>
          <button type="button" onClick={() => setLocateError(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">×</button>
        </div>
      )}

      {groups.filter((g) => g.members.length > 1).map((g) => {
        const open = openGroup === g.key
        return (
          <Marker
            key={g.key}
            longitude={g.anchor.longitude}
            latitude={g.anchor.latitude}
            anchor="bottom"
            style={{ zIndex: open ? 30 : 10 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              openGroupAt(g)
            }}
          >
            <span className="relative flex flex-col items-center cursor-pointer group">
              <span
                className="map-tag flex items-center gap-1.5 rounded-full pl-2 pr-1 py-1 text-[13px] font-medium leading-none text-foreground group-hover:-translate-y-0.5 transition-transform"
                title={g.members.map((m) => m.name).join(', ')}
              >
                <span aria-hidden className="flex gap-0.5">{g.members.slice(0, 3).map((m) => <span key={m.id}>{m.emoji ?? '•'}</span>)}</span>
                <span className="num rounded-full bg-foreground text-background text-[11px] font-semibold min-w-5 h-5 px-1.5 grid place-items-center">{g.members.length}</span>
                <span className="sr-only">circles</span>
              </span>
              <span aria-hidden className="map-dot mt-1.5" />
              {open && (
                // Same spot: the list is the only way to tell them apart.
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="map-tag absolute bottom-full mb-2 w-[min(280px,80vw)] rounded-2xl p-1.5 text-left cursor-default"
                >
                  <p className="px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground">{g.samePlace ? 'All meet at this spot' : 'Close together here'}</p>
                  <ul>
                    {g.members.map((m) => (
                      <li key={m.id}>
                        {/* A row is the circle: tapping it opens the circle,
                            which is what everyone expected it to do. */}
                        <Link
                          href={`/circles/${m.id}`}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-foreground/[0.06] text-left"
                        >
                          <span aria-hidden className="w-5 text-center">{m.emoji ?? '•'}</span>
                          <span className="flex-1 min-w-0 truncate text-sm font-medium">{m.name}</span>
                          {m.is_free === false && <span className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-cool-2">{m.price_note ?? 'Paid'}</span>}
                          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground"><path d="M9 6l6 6-6 6" /></svg>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </span>
          </Marker>
        )
      })}

      {groups.filter((g) => g.members.length === 1).map(({ anchor: circle }) => (
        <Marker
          key={circle.id}
          // The open card must sit above every other marker, groups included,
          // or a neighbouring "2 circles" badge draws over its title.
          style={{ zIndex: popupCircle?.id === circle.id ? 40 : 5 }}
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
              quiet treatment and a soft heat halo that says roughly here. */}
          {/* The glow under every pin now comes from the heat layer above,
              for members' circles too. Approximate circles keep the quiet
              tag: a sharp pin on displaced coordinates would be a lie. */}
          {/* The tag is the card. Tapping it does not swap it for a different
              popup; it grows downward, same paper, same ink edge, to show a
              line or two, then an Open link. The grid-rows trick animates
              height without knowing it in advance. Deselected, it folds back
              into a tag. */}
          {(() => {
            const open = popupCircle?.id === circle.id
            // Approximate circles read quieter (muted name, hollow dot);
            // businesses get a faint ring. No ink outlines: the glass is the edge.
            const edge = circle.approximate
              ? 'text-foreground/80'
              : circle.kind === 'commercial'
                ? 'ring-1 ring-foreground/25 text-foreground'
                : 'text-foreground'
            return (
              <span className={`relative flex flex-col items-center cursor-pointer group ${open ? 'z-20' : ''}`}>
                {/* The width is a min-width, and that is the whole trick.
                    w-[240px] is not animatable from auto, so it snapped to
                    full width on the first frame while the radius and the
                    body eased in behind it: for 300ms you got a wide flat
                    empty capsule with the name stranded on the left. Doing
                    the same on close was the first version of this bug.
                    min-width animates from 0, so the box, the corners and
                    the body all move together, and a name longer than 240px
                    simply keeps its natural width instead of being clamped.

                    Transitions live only on the open state, so opening
                    animates and closing snaps, which is what you want when
                    the close is caused by opening something else.

                    md-only: on a phone the bottom card already says all of
                    this, and expanding here put two copies of the same
                    circle on one screen. */}
                <div
                  className={`map-tag rounded-full ${edge} ${
                    open
                      ? 'md:rounded-2xl md:min-w-[240px] md:transition-[border-radius,min-width] md:duration-300 md:ease-out'
                      : 'md:min-w-0 group-hover:-translate-y-0.5 transition-transform duration-150'
                  }`}
                >
                  <button
                    type="button"
                    title={
                      circle.approximate
                        ? `${circle.name}, approximate area`
                        : circle.kind === 'commercial'
                          ? `${circle.name}, business`
                          : circle.name
                    }
                    // Not w-full. The title stretching to fill the box was
                    // half of why a short name sat in a wide empty capsule:
                    // width:100% resolved against a container the collapsed
                    // body had already made too wide, then clamped at 240.
                    // Shrink-wrapped, it is exactly as wide as the name.
                    className={`block text-left font-medium leading-none whitespace-nowrap truncate text-[13px] px-2.5 py-1.5 max-w-[46vw] md:max-w-[210px] ${
                      open ? 'md:text-[15px] md:px-3.5 md:pt-3 md:pb-1 md:max-w-none md:transition-[font-size] md:duration-300' : ''
                    }`}
                  >
                    {circle.emoji ? `${circle.emoji} ` : ''}{circle.name}
                    {/* Paid circles: a tinted tag and a $ mark, so cost reads
                        before anyone taps. Free is the default look. */}
                    {circle.is_free === false && <span aria-label="paid" className="ml-1.5 inline-grid place-items-center w-4 h-4 rounded-full bg-cool-2 text-foreground text-[10px] font-semibold align-[1px]">$</span>}
                  </button>
                  <div
                    // max-w-0 is the other half, and the non-obvious half.
                    // grid-rows-[0fr] collapses the body's HEIGHT, but its
                    // text still counted toward the container's intrinsic
                    // WIDTH: a one-line description of a Saturday volleyball
                    // game wanted ~300px, so the pill was 300px wide with the
                    // name floating at the left of it, on every marker, open
                    // or not. Capping the width at 0 while closed takes it out
                    // of that calculation, and max-width animates, so it grows
                    // in step with the corners and the rows.
                    className={`grid grid-rows-[0fr] opacity-0 max-w-0 ${
                      open
                        ? 'md:grid-rows-[1fr] md:opacity-100 md:max-w-[240px] md:transition-[grid-template-rows,opacity,max-width] md:duration-300 md:ease-out'
                        : ''
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3.5 pb-3 space-y-1.5 text-foreground">
                        {(circle.category || circle.kind === 'commercial') && (
                          <p className="font-medium text-sm text-muted-foreground leading-tight">
                            {[circle.category, circle.kind === 'commercial' ? 'business' : null].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {circle.is_free != null && (
                          <p className="text-xs font-medium">{circle.is_free ? 'Free' : `Paid${circle.price_note ? `: ${circle.price_note}` : ''}`}</p>
                        )}
                        {circle.description && (
                          <p className="text-xs leading-snug text-foreground/80 line-clamp-2">{circle.description}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="label">
                            {circle.memberCount !== undefined ? `${circle.memberCount} member${circle.memberCount !== 1 ? 's' : ''}` : ''}
                            {circle.approximate ? (circle.memberCount !== undefined ? ', ' : '') + 'approx. area' : ''}
                          </span>
                          <Link
                            href={`/circles/${circle.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-xs rounded-full bg-foreground text-background px-3 py-1 hover:opacity-85 transition-opacity"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <span aria-hidden className={`map-dot mt-1.5 ${circle.approximate ? 'map-dot-approx' : ''}`} />
              </span>
            )
          })()}
        </Marker>
      ))}

      {/* Bottom, not centre: dead centre is exactly where someone is looking
          and dragging, so it covered the map and followed them around. */}
      {/* pb-20 on phones, not p-4. The Map/List pill floats over the map's
          bottom 56px, so anything drawn at the map's own bottom edge lands
          under it: the empty-state card's buttons came out half-covered by
          the switch. Desktop has no pill and keeps the tighter inset. */}
      {emptyOverlay && nothingInView && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 pb-20 md:pb-4 pointer-events-none">
          <div className="pointer-events-auto">{emptyOverlay({ showAll, canShowAll, areaName })}</div>
        </div>
      )}
    </Map>
  )
}
