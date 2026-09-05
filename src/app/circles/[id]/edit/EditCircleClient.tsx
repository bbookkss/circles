'use client'

import { useState } from 'react'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { updateCircle } from '@/app/actions/circles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LocationSearch from '@/components/LocationSearch'
import BackButton from '@/components/BackButton'
import { reverseGeocode } from '@/lib/geocoding'
import { applyCoffeeTheme } from '@/lib/mapTheme'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const SF_CENTER = { longitude: -122.4194, latitude: 37.7749, zoom: 12 }

const CATEGORIES = ['Music', 'Sports', 'Food & Drink', 'Arts & Culture', 'Outdoors', 'Tech', 'Social', 'Other']
const EMOJI_OPTIONS = [
  '🏐', '⚽', '🏀', '🎾', '🏄', '🚴', '🧗', '🥾',
  '🎸', '🎹', '🎺', '🥁', '🎤', '🎭', '🎨', '📸',
  '🍕', '🍜', '🍣', '🍺', '☕', '🌮', '🍷', '🧃',
  '🌲', '🏕', '🌊', '🏔', '🌸', '🌻', '🦋', '🐾',
  '💻', '🤖', '🎮', '📚', '🔬', '🛠', '🎲', '♟',
  '🤝', '🏘', '🕍', '🏳️‍🌈', '✌️', '💪', '🙌', '❤️',
]
const DAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]
const FREQUENCIES = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every other week', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
]

type Circle = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  emoji?: string | null
  location?: string | null
  neighborhood?: string | null
  visibility: string
  latitude?: number | null
  longitude?: number | null
}

type Schedule = {
  days_of_week: number[]
  start_time: string
  end_time: string
  frequency: string
  note?: string | null
} | null


export default function EditCircleClient({ circle, schedule }: { circle: Circle; schedule: Schedule }) {
  const [pin, setPin] = useState<{ longitude: number; latitude: number } | null>(
    circle.latitude && circle.longitude
      ? { longitude: circle.longitude, latitude: circle.latitude }
      : null
  )
  const [neighborhood, setNeighborhood] = useState<string | null>(circle.neighborhood ?? null)
  const [city, setCity] = useState<string | null>((circle as any).city ?? null)
  const [geocoding, setGeocoding] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(circle.emoji ?? null)
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    circle.visibility === 'private' ? 'private' : 'public'
  )
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule?.days_of_week ?? [])
  const [hasSchedule, setHasSchedule] = useState(!!schedule)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleMapClick(lng: number, lat: number) {
    setPin({ longitude: lng, latitude: lat })
    setNeighborhood(null)
    setCity(null)
    setGeocoding(true)
    const result = await reverseGeocode(lng, lat)
    setNeighborhood(result.neighborhood)
    setCity(result.city)
    setGeocoding(false)
  }

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
    selectedDays.forEach((d) => formData.append('days_of_week', String(d)))
    const result = await updateCircle(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  const mapCenter = pin ?? SF_CENTER

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="w-96 flex-shrink-0 bg-background border-r flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <BackButton fallback={`/circles/${circle.id}`} />
          <h1 className="text-lg font-semibold lowercase">edit circle</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
          )}

          <input type="hidden" name="circle_id" value={circle.id} />

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" defaultValue={circle.name} required />
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
                  className={`text-xl p-1 rounded-md transition-colors hover:bg-muted ${selectedEmoji === emoji ? 'bg-muted ring-2 ring-foreground' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={circle.description ?? ''}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              defaultValue={circle.category ?? ''}
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
            <Input id="location" name="location" defaultValue={circle.location ?? ''} placeholder="Dolores Park..." />
          </div>

          <input type="hidden" name="latitude" value={pin?.latitude ?? ''} />
          <input type="hidden" name="longitude" value={pin?.longitude ?? ''} />
          <input type="hidden" name="neighborhood" value={neighborhood ?? ''} />
          <input type="hidden" name="city" value={city ?? ''} />

          <div className="space-y-2">
            <Label>Location search</Label>
            <LocationSearch
              onSelect={({ longitude, latitude, neighborhood: hood, city: c }) => {
                setPin({ longitude, latitude })
                setNeighborhood(hood)
                setCity(c)
              }}
            />
            <p className="text-xs text-muted-foreground">Or click the map directly to move the pin</p>
          </div>

          <div className="space-y-1">
            <Label>Pin</Label>
            {pin ? (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}{' '}
                  <button type="button" onClick={() => { setPin(null); setNeighborhood(null) }} className="underline ml-1">
                    remove
                  </button>
                </p>
                {geocoding && <p>Detecting neighborhood...</p>}
                {!geocoding && neighborhood && <p className="text-foreground font-medium">{neighborhood}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click anywhere on the map to drop a pin</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <input type="hidden" name="visibility" value={visibility} />
            <div className="flex gap-2">
              {(['public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                    visibility === v ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-input hover:bg-muted'
                  }`}
                >
                  {v === 'public' ? 'Public' : 'Private'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Recurring schedule</Label>
              <button type="button" onClick={() => setHasSchedule((v) => !v)} className="text-xs underline text-muted-foreground">
                {hasSchedule ? 'Remove' : '+ Add'}
              </button>
            </div>

            {hasSchedule && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          selectedDays.includes(day.value) ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-input hover:bg-muted'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start time</Label>
                    <Input id="start_time" name="start_time" type="time" defaultValue={schedule?.start_time ?? ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End time</Label>
                    <Input id="end_time" name="end_time" type="time" defaultValue={schedule?.end_time ?? ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <select
                    id="frequency"
                    name="frequency"
                    defaultValue={schedule?.frequency ?? 'weekly'}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule_note">Note <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="schedule_note" name="schedule_note" defaultValue={schedule?.note ?? ''} placeholder="Weather permitting..." />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </aside>

      <main className="flex-1 relative">
        <Map
          initialViewState={{ ...mapCenter, zoom: 13 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          cursor="crosshair"
          onLoad={(e) => applyCoffeeTheme(e.target)}
          onClick={(e) => handleMapClick(e.lngLat.lng, e.lngLat.lat)}
        >
          {pin && (
            <Marker longitude={pin.longitude} latitude={pin.latitude} anchor="center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white bg-white text-2xl">
                {selectedEmoji ?? '●'}
              </div>
            </Marker>
          )}
        </Map>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Click to move the pin
        </div>
      </main>
    </div>
  )
}
