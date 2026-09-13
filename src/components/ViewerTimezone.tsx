'use client'

import { useEffect } from 'react'

/**
 * Tells the server which timezone the viewer's device is actually in.
 *
 * Renders nothing. It exists because the server has no good way to know this
 * on its own: `x-vercel-ip-timezone` is free and needs no client code, but it
 * is an IP lookup, and this project has already watched one of those place a
 * person in Desert Hot Springs while they sat in San Diego. A VPN or a
 * corporate egress breaks it. The device's own setting is the thing the
 * person actually reads the time off, so it is the thing worth believing.
 *
 * Written to a cookie rather than held in React state because the pages that
 * need it are Server Components, and a cookie is the one channel that reaches
 * them. Set once per session and only when it changes, so this costs nothing
 * on a normal navigation.
 *
 * Not security-relevant: the worst a forged value does is mislabel the
 * reader's own clock.
 */
export default function ViewerTimezone() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tz) return
      const already = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('viewer_tz='))
      if (already === `viewer_tz=${tz}`) return
      // Lax rather than Strict: this should survive arriving from a flyer's
      // QR link, which is a cross-site navigation.
      document.cookie = `viewer_tz=${tz}; path=/; max-age=31536000; samesite=lax`
    } catch {
      // Intl is unavailable or the device has no zone. The server falls back
      // to the circle's own timezone, which is the sensible default anyway.
    }
  }, [])

  return null
}
