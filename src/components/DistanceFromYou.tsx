'use client'

import { useEffect, useState } from 'react'
import { distanceKm } from '@/lib/mapView'

/**
 * "about 2.3 mi from you".
 *
 * Renders the server's IP-based figure immediately, then quietly replaces it
 * with one measured from the device when the browser will give a position
 * without asking: only when this site has already been granted location.
 * Never prompts. A permission dialog for a caption is not a fair trade.
 *
 * Says "about" either way. The IP is city-level; the device fix is close but
 * the circle's coordinates may be the blurred area, which is honest to
 * roughly half a mile on purpose.
 */
export default function DistanceFromYou({
  latitude,
  longitude,
  initial,
}: {
  latitude: number
  longitude: number
  /** The server-rendered label, or null when the IP gave nothing. */
  initial: string | null
}) {
  const [label, setLabel] = useState<string | null>(initial)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return
            const mi =
              distanceKm(
                { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                { latitude, longitude }
              ) * 0.621371
            const n = mi < 0.1 ? 'under a tenth of a mile' : mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`
            setLabel(`about ${n} from you`)
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [latitude, longitude])

  if (!label) return null
  return <span>{label}</span>
}
