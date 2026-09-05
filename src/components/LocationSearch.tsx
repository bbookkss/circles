'use client'

import { useState, useRef, useEffect } from 'react'
import { extractFromFeature } from '@/lib/geocoding'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const SF_PROXIMITY = '-122.4194,37.7749'

type Suggestion = {
  place_name: string
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
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?autocomplete=true&country=us&proximity=${SF_PROXIMITY}&types=address,poi,neighborhood,locality&access_token=${MAPBOX_TOKEN}`
        )
        const json = await res.json()
        const results: Suggestion[] = (json.features ?? []).map((f: any) => {
          const { neighborhood, city } = extractFromFeature(f)
          return { place_name: f.place_name, center: f.center, neighborhood, city }
        })
        setSuggestions(results)
        setOpen(results.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.place_name)
    setOpen(false)
    setSuggestions([])
    onSelect({
      longitude: s.center[0],
      latitude: s.center[1],
      neighborhood: s.neighborhood,
      city: s.city,
      placeName: s.place_name,
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
                <span className="font-medium">{s.place_name.split(',')[0]}</span>
                <span className="text-muted-foreground text-xs block truncate">
                  {s.place_name.split(',').slice(1).join(',').trim()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
