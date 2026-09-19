'use client'

import { useState } from 'react'
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createCircle } from '@/app/actions/circles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LocationSearch from '@/components/LocationSearch'
import BackButton from '@/components/BackButton'
import { reverseGeocode } from '@/lib/geocoding'
import { installCoffeeTheme, COFFEE } from '@/lib/mapTheme'
import type { MapView } from '@/lib/mapView'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  '🎬',
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


export default function NewCircleClient({
  isBusiness = false,
  // Resolved on the server from the request's geo headers, so the map is
  // already in the right place on first paint. Doing it in the browser would
  // show San Francisco and then jump, which is worse than either alone.
  initialView = SF_CENTER,
}: {
  isBusiness?: boolean
  initialView?: MapView
}) {
  const [kind, setKind] = useState<'social' | 'commercial'>('social')
  const [pin, setPin] = useState<Pin | null>(null)
  const [neighborhood, setNeighborhood] = useState<string | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Controlled only so the Next button knows whether there is a name yet.
  const [name, setName] = useState('')
  const [showAllEmoji, setShowAllEmoji] = useState(false)

  /**
   * Three steps on a phone, one page on a desktop.
   *
   * Twelve fields down a single column, behind a map stuck to the top taking
   * 45% of the screen, left about 350px to work in: you scrolled, lost your
   * place, scrolled back. Split into what / where / when, each step is one
   * screenful and the map gets the whole screen on the step where you are
   * actually dropping a pin.
   *
   * Every field stays mounted the whole time and steps are hidden with
   * display:none, so FormData still collects the lot on submit and nothing
   * has to be lifted into state to survive a step change. The one casualty
   * is `required`: the browser refuses to submit a form with an invalid
   * required field it cannot scroll to, so validation is the guards below
   * plus the server, which refuses a circle with no pin or no schedule
   * anyway.
   */
  const [step, setStep] = useState(1)
  const stepGate: Record<number, string | null> = {
    1: name.trim() ? null : 'Give it a name first.',
    2: pin ? null : 'Drop a pin on the map.',
    3: selectedDays.length === 0 ? 'Pick at least one day it meets.' : null,
  }
  const blocked = stepGate[step]
  // `hidden md:block` rather than unmounting: desktop shows all three at once.
  const onStep = (n: number) => (step === n ? 'block' : 'hidden md:block')

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

    // Inject selected days as multiple values
    selectedDays.forEach((d) => formData.append('days_of_week', String(d)))

    const result = await createCircle(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col-reverse md:flex-row md:h-full w-full md:overflow-hidden">
      {/* Form sidebar */}
      <aside className="w-full md:w-96 md:flex-none md:flex-shrink-0 md:min-h-0 bg-background md:border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <BackButton fallback="/explore" />
            <h1 className="text-xl">New circle</h1>
          </div>
          {/* Phones only. Desktop shows every field at once, so a step
              counter there would be a lie. */}
          <div className="md:hidden flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 space-y-1">
                <div className={`h-1 rounded-full ${n <= step ? 'bg-pen' : 'bg-border'}`} />
                <p className={`label ${n === step ? 'text-pen' : ''}`}>
                  {n === 1 ? 'What' : n === 2 ? 'Where' : 'When'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="md:flex-1 md:overflow-y-auto p-4 pb-24 md:pb-4 space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          {/* ---- 1. What ---- */}
          <div className={`${onStep(1)} space-y-5`}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SF Beach Volleyball"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                name="category"
                defaultValue={""}
                items={{ '': 'Select a category', ...Object.fromEntries(CATEGORIES.map((c) => [c, c])) }}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select a category</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>Icon <span className="text-muted-foreground">(shows on the map)</span></Label>
                {selectedEmoji && (
                  <button type="button" onClick={() => setSelectedEmoji(null)} className="min-h-9 px-2 -mr-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                    Clear
                  </button>
                )}
              </div>
              <input type="hidden" name="emoji" value={selectedEmoji ?? ''} />
              {/* Forty-eight icons is six rows and most of a phone screen for
                  an optional field. Two rows, then ask. */}
              <div className={`grid grid-cols-8 gap-1 overflow-hidden ${showAllEmoji ? '' : 'max-h-[92px]'}`}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(selectedEmoji === emoji ? null : emoji)}
                    aria-pressed={selectedEmoji === emoji}
                    className={`text-xl aspect-square rounded-md transition-colors hover:bg-muted ${
                      selectedEmoji === emoji ? 'bg-muted ring-2 ring-pen' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAllEmoji((v) => !v)}
                className="min-h-9 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                {showAllEmoji ? 'Show fewer' : 'Show all icons'}
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description <span className="text-muted-foreground">(optional)</span></Label>
              <textarea
                id="description"
                name="description"
                placeholder="What's this circle about?"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <input type="hidden" name="latitude" value={pin?.latitude ?? ''} />
          <input type="hidden" name="longitude" value={pin?.longitude ?? ''} />
          <input type="hidden" name="neighborhood" value={neighborhood ?? ''} />
          <input type="hidden" name="city" value={city ?? ''} />

          {/* ---- 2. Where ---- */}
          <div className={`${onStep(2)} space-y-5`}>
            {/* Search, then map, then what to call it. The old order put a
                free-text "Location name" box above the finder and the pin,
                so the first thing asked was the last thing you could answer,
                and two of the three looked like the same question. */}
            <div className="space-y-2">
              <Label>Search for the spot</Label>
              <LocationSearch
                onSelect={({ longitude, latitude, neighborhood: hood, city: c }) => {
                  setPin({ longitude, latitude })
                  setNeighborhood(hood)
                  setCity(c)
                }}
              />
              <p className="text-xs text-muted-foreground">Or tap the map to drop a pin yourself.</p>
            </div>

            <div className={`border p-3 ${pin ? 'border-pen bg-pen-bg' : 'border-border'}`}>
              {pin ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {geocoding ? 'Finding the neighbourhood…' : neighborhood ?? 'Pin dropped'}
                    </p>
                    <p className="num text-xs text-muted-foreground mt-0.5">
                      {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPin(null); setNeighborhood(null); setCity(null) }}
                    className="min-h-9 px-2 -mr-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pin yet. Tap the map above.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">What to call it <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="location" name="location" placeholder="Dolores Park" />
              <p className="text-xs text-muted-foreground">
                The name people will read, like &ldquo;the tennis courts&rdquo; or &ldquo;Fleet Street Royal Farms&rdquo;.
              </p>
            </div>
          </div>

          {/* ---- 3. When ---- */}
          <div className={`${onStep(3)} space-y-5`}>
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
                    visibility === v
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-input hover:bg-muted'
                  }`}
                >
                  {v === 'public' ? 'Public' : 'Private'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {visibility === 'public'
                ? 'Anyone can find and join this circle.'
                : 'People must request to join. You approve them.'}
            </p>
          </div>

          {/* Kind — only offered to verified businesses. The database rejects
              a commercial circle from anyone else regardless of this UI. */}
          {isBusiness && (
            <div className="space-y-2">
              <Label>Circle type</Label>
              <input type="hidden" name="kind" value={kind} />
              <div className="flex gap-2">
                {(['social', 'commercial'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                      kind === k
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-input hover:bg-muted'
                    }`}
                  >
                    {k === 'social' ? 'Social' : 'Commercial'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {kind === 'social'
                  ? "A regular circle, same as anyone else's."
                  : 'Promotes your venue. Shown in its own colour on the map, and people can filter for it.'}
              </p>
            </div>
          )}

          {/* Schedule section */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <Label>When it meets</Label>
              <span className="label normal-case tracking-normal">every circle has a schedule</span>
            </div>

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
                  <Select
                    name="frequency"
                    defaultValue={"weekly"}
                    items={FREQUENCIES}
                  >
                    <SelectTrigger id="frequency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Starts on — anchors the recurrence */}
                <div className="space-y-2">
                  <Label htmlFor="starts_on">First meet</Label>
                  <Input
                    id="starts_on"
                    name="starts_on"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Every later meet is counted from this date. For every other
                    week or monthly, this is what decides which week.
                  </p>
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
          </div>
          </div>

          {/* Phones: Back and Next, and Create only on the last step. The
              gate message says which field is missing rather than leaving a
              dead button and no explanation. */}
          <div className="md:hidden space-y-2 pt-2">
            {blocked && <p className="label normal-case tracking-normal">{blocked}</p>}
            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full min-h-11 px-6"
                  onClick={() => setStep((n) => n - 1)}
                >
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button
                  type="button"
                  className="rounded-full min-h-11 flex-1"
                  disabled={!!blocked}
                  onClick={() => setStep((n) => n + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" className="rounded-full min-h-11 flex-1" disabled={loading || !!blocked || !pin}>
                  {loading ? 'Creating…' : 'Create circle'}
                </Button>
              )}
            </div>
          </div>

          {/* Desktop: one page, one button. */}
          <div className="hidden md:block space-y-2">
            {(!pin || selectedDays.length === 0 || !name.trim()) && (
              <p className="label normal-case tracking-normal">
                {!name.trim() ? 'Give it a name.' : !pin ? 'Drop a pin on the map.' : 'Pick at least one day it meets.'}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !pin || selectedDays.length === 0 || !name.trim()}>
              {loading ? 'Creating...' : 'Create Circle'}
            </Button>
          </div>
        </form>
      </aside>

      {/* Map pin picker */}
      {/* Phones stack this above the form at a usable height. Side by side,
          the fixed w-96 form left about 6px of map on a 390px screen --
          enough to see it exists, not to drop a pin on it. */}
      <main className={`${step === 2 ? 'block' : 'hidden'} md:block h-[55vh] min-h-[300px] md:h-auto md:min-h-0 flex-shrink-0 md:flex-1 relative border-b md:border-b-0 sticky top-14 md:static`}>
        <Map
          initialViewState={initialView}
          style={{ width: '100%', height: '100%', background: COFFEE }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          cursor="crosshair"
          onLoad={(e) => installCoffeeTheme(e.target)}
          onClick={(e) => handleMapClick(e.lngLat.lng, e.lngLat.lat)}
        >
          {/* The explore map had a locate button; this one did not, and this
              is the page where "where am I" matters most. Locating only moves
              the view: the pin is still placed by tapping, since a phone's
              fix can be a block off and the meeting spot should be exact. */}
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl
            position="top-right"
            positionOptions={{ enableHighAccuracy: true, timeout: 10000 }}
            fitBoundsOptions={{ zoom: 15 }}
          />
          {pin && (
            <Marker longitude={pin.longitude} latitude={pin.latitude} anchor="center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white ${selectedEmoji ? 'bg-white text-2xl' : 'bg-white text-lg'}`}>
                {selectedEmoji ?? '●'}
              </div>
            </Marker>
          )}
        </Map>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Tap to place your circle&apos;s location
        </div>
      </main>
    </div>
  )
}
