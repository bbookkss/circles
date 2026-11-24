'use client'

import { useCallback, useState } from 'react'

/**
 * The person's location, only after they tap "Use my location" and the
 * browser asks them. Rounded to two decimal places (about 1 km) before it
 * leaves the device; the server rounds again and never stores it. Not kept
 * anywhere, so every visit asks again (and server and browser render alike).
 */
export type NearMe = { lat: number; lng: number }
type Status = 'off' | 'asking' | 'on' | 'denied' | 'unavailable'

export function useNearMe() {
  const [near, setNear] = useState<NearMe | null>(null)
  const [status, setStatus] = useState<Status>('off')

  const ask = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('unavailable')
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const r = (n: number) => Math.round(n * 100) / 100
        const v = { lat: r(p.coords.latitude), lng: r(p.coords.longitude) }
        setNear(v)
        setStatus('on')
      },
      (e) => setStatus(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 10_000 }
    )
  }, [])

  const forget = useCallback(() => {
    setNear(null)
    setStatus('off')
  }, [])

  return { near, status, ask, forget }
}

/** A short line for the control, by state. */
export function nearLabel(status: Status): string {
  switch (status) {
    case 'on': return 'Using your rough location (about 1 km)'
    case 'asking': return 'Finding you…'
    case 'denied': return 'Location is off in your browser, so results use your rough area'
    case 'unavailable': return "Couldn't get your location, so results use your rough area"
    default: return 'Use my location'
  }
}

/**
 * What happens when someone turns location on, said before the browser asks.
 * Every claim here is enforced in code: rounded on the device (above), rounded
 * again on the server (lib/ai/near.ts), passed to one request at a time, and
 * never written to the database.
 */
export const LOCATION_EXPLAINER =
  "It's rounded to about 1 km on your device, sent only with your questions to find circles nearby, and never saved or shown to other people. Turn it off any time."
