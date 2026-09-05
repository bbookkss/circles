'use client'

import { useState } from 'react'
import Link from 'next/link'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createCircle } from '@/app/actions/circles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const SF_CENTER = { longitude: -122.4194, latitude: 37.7749, zoom: 12 }

const CATEGORIES = [
  'Music', 'Sports', 'Food & Drink', 'Arts & Culture',
  'Outdoors', 'Tech', 'Social', 'Other',
]

const EMOJI_OPTIONS = [
  '🏐', '⚽', '🏀', '🎾', '🏄', '🚴', '🧗', '🥾',
  '🎸', '🎹', '🎺', '🥁', '🎤', '🎭', '🎨', '📸',
  '🍕', '🍜', '🍣', '🍺', '☕', '🌮', '🍷', '🧃',
  '🌲', '🏕', '🌊', '🏔', '🌸', '🌻', '🦋', '🐾',
  '💻', '🤖', '🎮', '📚', '🔬', '🛠', '🎲', '♟',
  '🤝', '🏘', '🕍', '🏳️‍🌈', '✌️', '💪', '🙌', '❤️',
]

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]

const FREQUENCIES = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every other week', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
]

type Pin = { longitude: number; latitude: number }

export default function NewCircleClient() {
  const [pin, setPin] = useState<Pin | null>(null)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [hasSchedule, setHasSchedule] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function toggleDay(value: number) {
    setSelectedDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    // Inject selected days as multiple values
    selectedDays.forEach((d) => formData.append('days_of_week', String(d)))

    const result = await createCircle(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Form sidebar */}
      <aside className="w-96 flex-shrink-0 bg-background border-r flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">New Circle</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          {/* Basic info */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="SF Beach Volleyball" required />
          </div>

          <div className="space-y-2">
            <Label>Emoji <span className="text-muted-foreground">(shows on map)</span></Label>
            <input type="hidden" name="emoji" value={selectedEmoji ?? ''} />
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(selectedEmoji === emoji ? null : emoji)}
                  className={`text-xl p-1 rounded-md transition-colors hover:bg-muted ${
                    selectedEmoji === emoji ? 'bg-muted ring-2 ring-foreground' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {selectedEmoji && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedEmoji}{' '}
                <button type="button" onClick={() => setSelectedEmoji(null)} className="underline">clear</button>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="What's this circle about?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location name</Label>
            <Input id="location" name="location" placeholder="Dolores Park, Mission District..." />
          </div>

          <input type="hidden" name="latitude" value={pin?.latitude ?? ''} />
          <input type="hidden" name="longitude" value={pin?.longitude ?? ''} />

          <div className="space-y-2">
            <Label>Pin on map</Label>
            {pin ? (
              <p className="text-xs text-muted-foreground">
                📍 {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}{' '}
                <button type="button" onClick={() => setPin(null)} className="underline ml-1">
                  remove
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Click anywhere on the map to drop a pin</p>
            )}
          </div>

          {/* Schedule section */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Recurring schedule</Label>
              <button
                type="button"
                onClick={() => setHasSchedule((v) => !v)}
                className="text-xs underline text-muted-foreground"
              >
                {hasSchedule ? 'Remove' : '+ Add'}
              </button>
            </div>

            {hasSchedule && (
              <div className="space-y-4">
                {/* Day picker */}
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          selectedDays.includes(day.value)
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-foreground border-input hover:bg-muted'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start time</Label>
                    <Input id="start_time" name="start_time" type="time" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End time</Label>
                    <Input id="end_time" name="end_time" type="time" />
                  </div>
                </div>

                {/* Frequency */}
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <select
                    id="frequency"
                    name="frequency"
                    defaultValue="weekly"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <Label htmlFor="schedule_note">Note <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="schedule_note"
                    name="schedule_note"
                    placeholder="Weather permitting, bring your own ball..."
                  />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Circle'}
          </Button>
        </form>
      </aside>

      {/* Map pin picker */}
      <main className="flex-1 relative">
        <Map
          initialViewState={SF_CENTER}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          cursor="crosshair"
          onClick={(e) => setPin({ longitude: e.lngLat.lng, latitude: e.lngLat.lat })}
        >
          {pin && (
            <Marker longitude={pin.longitude} latitude={pin.latitude} anchor="center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white ${selectedEmoji ? 'bg-white text-2xl' : 'bg-white text-lg'}`}>
                {selectedEmoji ?? '📍'}
              </div>
            </Marker>
          )}
        </Map>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Click to place your circle&apos;s location
        </div>
      </main>
    </div>
  )
}
