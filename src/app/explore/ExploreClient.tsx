'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import type { CirclePin } from '@/components/map/CirclesMap'
import { Button } from '@/components/ui/button'

// Dynamically import the map so it only runs client-side (mapbox-gl requires a browser)
const CirclesMap = dynamic(() => import('@/components/map/CirclesMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400 text-sm">
      Loading map...
    </div>
  ),
})

type Props = {
  circles: CirclePin[]
}

export default function ExploreClient({ circles }: Props) {
  const [selected, setSelected] = useState<CirclePin | null>(null)

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-background border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold">Circles</Link>
          <Link href="/circles/new">
            <Button size="sm">+ New</Button>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          {circles.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No circles with locations yet.{' '}
              <Link href="/circles/new" className="underline">Create one.</Link>
            </div>
          ) : (
            <ul>
              {circles.map((circle) => (
                <li key={circle.id}>
                  <button
                    onClick={() => setSelected(circle)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                      selected?.id === circle.id ? 'bg-muted' : ''
                    }`}
                  >
                    <p className="font-medium text-sm">{circle.name}</p>
                    {circle.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{circle.category}</p>
                    )}
                    {circle.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {circle.description}
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
      <main className="flex-1 relative">
        <CirclesMap circles={circles} onCircleClick={setSelected} />
      </main>
    </div>
  )
}
