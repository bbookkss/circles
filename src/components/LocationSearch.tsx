'use client'

import { useState, useRef, useEffect } from 'react'
import { extractFromSearchBox } from '@/lib/geocoding'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const SF_PROXIMITY = '-122.4194,37.7749'

type Suggestion = {
  /** "Mission Dolores Park" — the thing you were looking for. */
  name: string
  /** "Dolores Street, San Francisco, California 94114" — where it is. */
  address: string
  center: [number, number]
  neighborhood: string | null
  city: string | null
}

type Props = {
  onSelect: (result: { longitude: number; latitude: number; neighborhood: string | null; city: string | null; placeName: string }) => void
}

export default function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        // Search Box, not the Geocoding API. Geocoding has no POI data at
        // all any more -- v6 rejects `types=poi` outright -- so searching
        // "dolores park" there returned streets named Dolores in Houston and
        // never the park itself. Circles meet at parks, cafes and bars, so
        // POIs are the whole point of this box.
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(value)}&proximity=${SF_PROXIMITY}&country=us&limit=6&access_token=${MAPBOX_TOKEN}`
        )
        const json = await res.json()
        const results: Suggestion[] = (json.features ?? []).map((f: any) => {
          const { neighborhood, city } = extractFromSearchBox(f)
          const props = f.properties ?? {}
          const name: string = props.name ?? props.full_address ?? ''
          const full: string = props.full_address ?? props.place_formatted ?? ''
          // For an address result the name is the head of full_address; don't
          // print it twice.
          const address = full.startsWith(name) ? full.slice(name.length).replace(/^,\s*/, '') : full
          return {
            name,
            address,
            center: f.geometry?.coordinates as [number, number],
            neighborhood,
            city,
          }
        }).filter((s: Suggestion) => Array.isArray(s.center))
        setSuggestions(results)
        setOpen(results.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.address ? `${s.name}, ${s.address}` : s.name)
    setOpen(false)
    setSuggestions([])
    onSelect({
      longitude: s.center[0],
      latitude: s.center[1],
      neighborhood: s.neighborhood,
      city: s.city,
      placeName: s.address ? `${s.name}, ${s.address}` : s.name,
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search address or place..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pr-8"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">...</span>
        )}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <span className="font-medium">{s.name}</span>
                {s.address && (
                  <span className="text-muted-foreground text-xs block truncate">{s.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
