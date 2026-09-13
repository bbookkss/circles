'use client'

import { useEffect, useState } from 'react'
import { tzAbbrev, sameWallClock } from '@/lib/schedule'

/**
 * Appends a circle's timezone to a meet time, but only for readers whose own
 * clock disagrees with it.
 *
 * This decides in the browser rather than on the server, and that is the
 * point. The first version read the reader's zone from a cookie written by a
 * client component, which meant the server had already rendered the page by
 * the time the zone was known: the first load after arriving in a new city
 * showed no timezone at all, and only a second load picked it up. A traveller
 * glancing at the app on landing is precisely the person the label exists
 * for, so it has to be right the first time.
 *
 * Renders nothing until mounted, so the server and the first client render
 * agree and hydration stays quiet. The reader's zone is a client fact; there
 * is no honest server-rendered answer to wait for.
 */
export default function MeetZone({ tz }: { tz: string }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    try {
      const mine = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!mine || sameWallClock(mine, tz)) return
      setLabel(tzAbbrev(tz))
    } catch {
      // No Intl, or an unknown zone name. Showing nothing is correct: the
      // time is already in the circle's zone, which is what it claims to be.
    }
  }, [tz])

  if (!label) return null
  return <> {label}</>
}
