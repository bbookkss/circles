'use client'

import { useEffect } from 'react'
import { markAllNotificationsRead } from '@/app/actions/notifications'

// Marks all notifications read when the page mounts. The action revalidates
// the layout so the nav's unread badge clears.
export default function ReadMarker() {
  useEffect(() => {
    markAllNotificationsRead()
  }, [])
  return null
}
