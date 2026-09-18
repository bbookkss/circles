'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useMemo, useEffect } from 'react'
import type { CirclePin } from '@/components/map/CirclesMap'
import { distanceKm, type MapView } from '@/lib/mapView'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CirclesMap = dynamic(() => import('@/components/map/CirclesMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
      Loading map...
    </div>
  ),
})

const CATEGORIES = ['Music', 'Sports', 'Food & Drink', 'Arts & Culture', 'Outdoors', 'Tech', 'Social', 'Other']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type CircleWithMeta = CirclePin & {
  member_count?: number
  days_of_week?: number[]
  location?: string | null
  neighborhood?: string | null
  city?: string | null
}

type Person = {
  id: string
  full_name: string | null
  instagram: string | null
}

type LatLng = { latitude: number; longitude: number }

type Props = {
  circles: CircleWithMeta[]
  people: Person[]
  initialView?: MapView
  /**
   * Where the visitor roughly is, from the IP on the server. City-level, so
   * good enough to sort by and say "about 3 mi", and upgraded to the device's
   * own fix when the browser will give one without a prompt.
   */
  origin?: LatLng | null
}

/** "0.4 mi", "2.3 mi", "14 mi". Under a tenth of a mile is "nearby". */
function milesLabel(km: number): string {
  const mi = km * 0.621371
  if (mi < 0.1) return 'nearby'
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

export default function ExploreClient({ circles, people, initialView, origin: originProp = null }: Props) {
  const [selected, setSelected] = useState<CircleWithMeta | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [dayFilter, setDayFilter] = useState<number | null>(null)
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [sizeFilter, setSizeFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<'social' | 'commercial' | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  // Phones get one or the other, full screen. A half-height map is too small
  // to pan or pinch, and a squeezed list shows a circle and a half -- which is
  // what this page was doing before. Desktop is unaffected.
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')

  // Derive unique cities from actual circle data
  const cities = useMemo(() => {
    const cs = circles.map((c) => c.city).filter(Boolean) as string[]
    return [...new Set(cs)].sort()
  }, [circles])

  // Derive unique neighborhoods, filtered by selected city
  const neighborhoods = useMemo(() => {
    const source = cityFilter ? circles.filter((c) => c.city === cityFilter) : circles
    const hoods = source.map((c) => c.neighborhood).filter(Boolean) as string[]
    return [...new Set(hoods)].sort()
  }, [circles, cityFilter])

  const filtered = useMemo(() => {
    return circles.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter && c.category !== categoryFilter) return false
      if (cityFilter && c.city !== cityFilter) return false
      if (neighborhoodFilter && c.neighborhood !== neighborhoodFilter) return false
      if (dayFilter !== null && !c.days_of_week?.includes(dayFilter)) return false
      if (sizeFilter === 'small' && (c.member_count ?? 0) >= 10) return false
      if (sizeFilter === 'medium' && ((c.member_count ?? 0) < 10 || (c.member_count ?? 0) >= 50)) return false
      if (sizeFilter === 'large' && (c.member_count ?? 0) < 50) return false
      // Anything without an explicit kind is a social circle.
      if (kindFilter && (c.kind ?? 'social') !== kindFilter) return false
      return true
    })
  }, [circles, search, categoryFilter, dayFilter, cityFilter, neighborhoodFilter, sizeFilter, kindFilter])

  // Where distances are measured from. Starts as the server's IP guess and
  // is replaced by the device's fix when one arrives: silently on mount if
  // the person has already granted location to this site (no prompt), or
  // when they tap the locate button on the map.
  const [origin, setOrigin] = useState<LatLng | null>(originProp)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // The list in distance order, nearest first, with a label for each. Any
  // circle whose coordinates are the blurred area gets "~": the number is
  // honest to within about half a mile, which is the point of the blur.
  const sorted = useMemo(() => {
    const rows = filtered.map((circle) => {
      const km = origin ? distanceKm(origin, circle) : null
      return { circle, km, miles: km === null ? null : `${circle.approximate ? '~' : ''}${milesLabel(km)}` }
    })
    if (!origin) return rows
    return rows.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
  }, [filtered, origin])

  // People matching the search term (only when actively searching)
  const peopleResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return people
      .filter((p) => (p.full_name?.toLowerCase().includes(q)) || (p.instagram?.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [people, search])

  const hasFilters = !!(search || categoryFilter || dayFilter !== null || cityFilter || neighborhoodFilter || sizeFilter || kindFilter)
  // Search is deliberately not counted: it has its own visible field, and
  // counting it would make the button light up while somebody types.
  const activeFilterCount = [categoryFilter, dayFilter !== null ? 'd' : null, cityFilter, neighborhoodFilter, sizeFilter, kindFilter].filter(Boolean).length

  function clearFilters() {
    setSearch('')
    setCategoryFilter(null)
    setDayFilter(null)
    setCityFilter(null)
    setNeighborhoodFilter(null)
    setSizeFilter(null)
    setKindFilter(null)
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden pt-14 pb-16 md:pb-0">

      {/* Sidebar */}
      <aside
        className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-72 flex-1 md:flex-none flex-shrink-0 min-h-0 bg-background md:border-r flex-col`}
      >
        {/* Search + filter toggle */}
        <div className="p-3 border-b space-y-2">
          <input
            type="text"
            placeholder="Search circles and people"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-0 border-b border-foreground bg-transparent px-0 py-1.5 text-base font-display placeholder:text-muted-foreground placeholder:font-sans placeholder:text-sm focus-visible:outline-none focus-visible:border-pen"
          />
          {/* A bordered pill with a chevron and a count, because the old
              version was tracked grey uppercase text with no affordance at
              all: it read as a section heading, not a button, and it was
              nowhere near a 24px target. */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-sm font-medium transition-colors ${
                activeFilterCount > 0
                  ? 'border-pen text-pen bg-pen-bg'
                  : 'border-foreground text-foreground hover:bg-muted'
              }`}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-pen text-white text-[11px] font-semibold leading-5 text-center">
                  {activeFilterCount}
                </span>
              )}
              <svg viewBox="0 0 24 24" aria-hidden className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 px-3 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="border-b p-3 space-y-4 bg-muted/30">
            {/* Social vs commercial */}
            <div>
              <p className="text-xs font-medium mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { value: 'social', label: 'Social' },
                  { value: 'commercial', label: 'Businesses' },
                ] as const).map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKindFilter(kindFilter === k.value ? null : k.value)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      kindFilter === k.value
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="text-xs font-medium mb-1.5">Category</p>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      categoryFilter === cat
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Meets on */}
            <div>
              <p className="text-xs font-medium mb-1.5">Meets on</p>
              <div className="flex gap-1">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => setDayFilter(dayFilter === i ? null : i)}
                    className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                      dayFilter === i
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <p className="text-xs font-medium mb-1.5">City</p>
              {cities.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No cities detected yet</p>
              ) : (
                <Select
                  value={cityFilter ?? ''}
                  onValueChange={(v) => {
                    setCityFilter((v as string) || null)
                    setNeighborhoodFilter(null)
                  }}
                  items={{ '': 'Any city', ...Object.fromEntries(cities.map((c) => [c, c])) }}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any city</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Neighborhood */}
            <div>
              <p className="text-xs font-medium mb-1.5">Neighborhood</p>
              {neighborhoods.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{cityFilter ? 'No neighborhoods in this city yet' : 'No neighborhoods detected yet'}</p>
              ) : (
                <Select
                  value={neighborhoodFilter ?? ''}
                  onValueChange={(v) => setNeighborhoodFilter((v as string) || null)}
                  items={{ '': 'Any', ...Object.fromEntries(neighborhoods.map((n) => [n, n])) }}
                >
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {neighborhoods.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Size */}
            <div>
              <p className="text-xs font-medium mb-1.5">Circle size</p>
              <div className="flex gap-1">
                {[['small', 'Small (<10)'], ['medium', 'Medium (10–50)'], ['large', 'Large (50+)']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSizeFilter(sizeFilter === val ? null : val)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      sizeFilter === val
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {/* People matches (only while searching) */}
          {peopleResults.length > 0 && (
            <div className="border-b">
              <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">People</p>
              <ul>
                {peopleResults.map((p) => (
                  <li key={p.id}>
                    <Link href={`/profile/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(p.full_name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        {p.instagram && <p className="text-xs text-muted-foreground truncate">@{p.instagram}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="label px-4 py-2.5 border-b">
            {peopleResults.length > 0 ? 'circles · ' : ''}{filtered.length} circle{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No circles match your filters.
            </div>
          ) : (
            <ul>
              {sorted.map(({ circle, miles }) => (
                <li key={circle.id}>
                  <button
                    onClick={() => {
                      setSelected(circle)
                      // On a phone the list and the map are separate screens,
                      // so flying the map somewhere the person cannot see is
                      // the same as doing nothing. Show it.
                      setMobileView('map')
                    }}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                      selected?.id === circle.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display font-semibold text-[1.05rem] leading-tight truncate">
                        {circle.emoji && <span className="mr-1.5">{circle.emoji}</span>}{circle.name}
                      </p>
                      {miles && <span className="num text-xs text-foreground/80 flex-shrink-0">{miles}</span>}
                    </div>
                    <p className="text-xs text-foreground/75 truncate mt-0.5">
                      {[circle.neighborhood ?? circle.location, circle.member_count !== undefined ? `${circle.member_count} member${circle.member_count !== 1 ? 's' : ''}` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                    {(circle.category || (circle.days_of_week && circle.days_of_week.length > 0)) && (
                      <p className="label mt-1">
                        {[circle.category, circle.days_of_week && circle.days_of_week.length > 0
                          ? [...circle.days_of_week].sort().map((d) => DAYS[d]).join(' ')
                          : null].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </aside>

      {/* Map */}
      <main className={`${mobileView === 'map' ? 'block' : 'hidden'} md:block flex-1 relative min-h-0`}>
        <CirclesMap
          circles={filtered}
          onCircleClick={setSelected}
          focus={selected}
          onLocate={setOrigin}
          onDeselect={() => setSelected(null)}
          initialView={initialView}
          // Suppressed while filtering: an empty view is then the filters
          // doing their job, not an area with nothing in it.
          emptyOverlay={hasFilters ? undefined : ({ showAll, canShowAll, areaName }) => (
            <div className="bg-background/95 backdrop-blur border rounded-xl px-5 py-4 text-center shadow-lg max-w-xs">
              {/* Two different situations, and naming a city in the second one
                  would be a lie by implication: it suggests circles exist
                  somewhere else, which is what the button then fails to show.
                  areaName tracks the map, not the visitor's IP. */}
              <p className="text-sm font-medium">
                {canShowAll
                  ? `No circles ${areaName ? `in ${areaName}` : 'here'} yet`
                  : 'No circles anywhere yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Someone has to be first. It may as well be you.
              </p>
              <div className="flex gap-2 justify-center mt-3">
                <Link href="/circles/new">
                  <Button size="sm">Start one</Button>
                </Link>
                {/* Hidden rather than disabled when there is nothing to pull
                    back to. A disabled control still says "there is more,
                    elsewhere", and there isn't. */}
                {canShowAll && (
                  <Button size="sm" variant="outline" onClick={showAll}>
                    See everywhere
                  </Button>
                )}
              </div>
            </div>
          )}
        />
        {selected && (
          <div className="absolute bottom-[8.5rem] md:bottom-6 left-1/2 -translate-x-1/2 bg-background border border-foreground shadow-lg px-5 py-3 flex items-center gap-4 min-w-[260px] max-w-[calc(100%-2rem)]">
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-lg leading-tight truncate">
                {selected.emoji && <span className="mr-1.5">{selected.emoji}</span>}{selected.name}
              </p>
              <p className="font-display italic text-sm text-pen truncate">
                {[selected.category, selected.neighborhood ?? selected.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Link href={`/circles/${selected.id}`}>
              <Button size="sm" className="rounded-full">Open</Button>
            </Link>
          </div>
        )}
      </main>

      {/* Map / List, at the bottom where a thumb is rather than at the top
          where it was. Sits above the bottom bar and clears the home
          indicator. "+ New Circle" used to be a full-width button pinned
          under the list; it is a destination in the bottom bar now, so it
          does not need to be here too. */}
      <div className="md:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30">
        <div className="flex bg-background border border-foreground rounded-full shadow-[0_4px_14px_-4px_rgba(34,31,27,0.4)] p-1">
          {(['map', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setMobileView(v)}
              aria-pressed={mobileView === v}
              className={`min-h-9 px-5 rounded-full text-sm font-medium capitalize transition-colors ${
                mobileView === v ? 'bg-pen text-white' : 'text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
