'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { CirclePin } from '@/components/map/CirclesMap'
import { Button } from '@/components/ui/button'

const CirclesMap = dynamic(() => import('@/components/map/CirclesMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400 text-sm">
      Loading map...
    </div>
  ),
})

const CATEGORIES = ['Music', 'Sports', 'Food & Drink', 'Arts & Culture', 'Outdoors', 'Tech', 'Social', 'Other']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SF_NEIGHBORHOODS = ['Mission', 'SOMA', 'Castro', 'Haight', 'Marina', 'Richmond', 'Sunset', 'Tenderloin', 'Nob Hill', 'Pacific Heights', 'Dogpatch', 'Potrero Hill']

type CircleWithMeta = CirclePin & {
  member_count?: number
  days_of_week?: number[]
  location?: string | null
}

type Props = {
  circles: CircleWithMeta[]
}

export default function ExploreClient({ circles }: Props) {
  const [selected, setSelected] = useState<CircleWithMeta | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [dayFilter, setDayFilter] = useState<number | null>(null)
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null)
  const [sizeFilter, setSizeFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    return circles.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter && c.category !== categoryFilter) return false
      if (neighborhoodFilter && !c.location?.toLowerCase().includes(neighborhoodFilter.toLowerCase())) return false
      if (dayFilter !== null && !c.days_of_week?.includes(dayFilter)) return false
      if (sizeFilter === 'small' && (c.member_count ?? 0) >= 10) return false
      if (sizeFilter === 'medium' && ((c.member_count ?? 0) < 10 || (c.member_count ?? 0) >= 50)) return false
      if (sizeFilter === 'large' && (c.member_count ?? 0) < 50) return false
      return true
    })
  }, [circles, search, categoryFilter, dayFilter, neighborhoodFilter, sizeFilter])

  const hasFilters = !!(search || categoryFilter || dayFilter !== null || neighborhoodFilter || sizeFilter)

  function clearFilters() {
    setSearch('')
    setCategoryFilter(null)
    setDayFilter(null)
    setNeighborhoodFilter(null)
    setSizeFilter(null)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden pt-14">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-background border-r flex flex-col">
        {/* Search + filter toggle */}
        <div className="p-3 border-b space-y-2">
          <input
            type="text"
            placeholder="Search circles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showFilters ? '▲ Hide filters' : '▼ Filters'}
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground underline hover:text-foreground">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="border-b p-3 space-y-4 bg-muted/30">
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

            {/* Neighborhood */}
            <div>
              <p className="text-xs font-medium mb-1.5">Neighborhood</p>
              <select
                value={neighborhoodFilter ?? ''}
                onChange={(e) => setNeighborhoodFilter(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none"
              >
                <option value="">Any</option>
                {SF_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
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
          <p className="px-4 py-2 text-xs text-muted-foreground border-b">
            {filtered.length} circle{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No circles match your filters.
            </div>
          ) : (
            <ul>
              {filtered.map((circle) => (
                <li key={circle.id}>
                  <button
                    onClick={() => setSelected(circle)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                      selected?.id === circle.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">{circle.emoji ?? '●'}</span>
                      <p className="font-medium text-sm truncate">{circle.name}</p>
                    </div>
                    {circle.category && (
                      <p className="text-xs text-muted-foreground">{circle.category}</p>
                    )}
                    {circle.location && (
                      <p className="text-xs text-muted-foreground truncate">📍 {circle.location}</p>
                    )}
                    {circle.member_count !== undefined && (
                      <p className="text-xs text-muted-foreground">👥 {circle.member_count}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 border-t">
          <Link href="/circles/new">
            <Button size="sm" className="w-full">+ New Circle</Button>
          </Link>
        </div>
      </aside>

      {/* Map */}
      <main className="flex-1 relative">
        <CirclesMap circles={filtered} onCircleClick={setSelected} />
        {selected && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 min-w-[240px]">
            <span className="text-2xl">{selected.emoji ?? '●'}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">{selected.name}</p>
              {selected.category && <p className="text-xs text-muted-foreground">{selected.category}</p>}
            </div>
            <Link href={`/circles/${selected.id}`}>
              <Button size="sm">View</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
