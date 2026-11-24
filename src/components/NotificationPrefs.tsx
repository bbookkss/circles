'use client'

import { useState } from 'react'
import { savePushPref, type PushPrefKey } from '@/app/actions/settings'

/**
 * Which notifications, for this person on every device. Each switch saves on
 * tap; a failed save flips it back and says so.
 */
const ROWS: { key: PushPrefKey; label: string; hint: string }[] = [
  { key: 'push_checkin_open', label: 'Check-in opens', hint: "A day before a meet you haven't answered" },
  { key: 'push_soon', label: 'Starting soon', hint: "3 hours before a meet you're going to" },
  { key: 'push_friends', label: 'Friends are going', hint: 'When two people you follow say yes to a meet you haven’t answered' },
  { key: 'push_going', label: 'Who’s coming', hint: "New yes answers for a meet you're going to or run, at most every 3 hours" },
  { key: 'push_changes', label: 'Meet changes', hint: 'The time, days or place of a meet you answered changes' },
  { key: 'push_requests', label: 'Join requests', hint: 'Someone asks to join a circle you run' },
  { key: 'push_messages', label: 'Messages', hint: 'Someone messages you' },
]

export default function NotificationPrefs({ initial }: { initial: Partial<Record<PushPrefKey, boolean>> }) {
  const [prefs, setPrefs] = useState(() => Object.fromEntries(ROWS.map((r) => [r.key, initial[r.key] ?? true])) as Record<PushPrefKey, boolean>)
  const [error, setError] = useState<string | null>(null)

  async function flip(key: PushPrefKey) {
    const next = !prefs[key]
    setPrefs((p) => ({ ...p, [key]: next }))
    setError(null)
    const res = await savePushPref(key, next)
    if ('error' in res && res.error) {
      setPrefs((p) => ({ ...p, [key]: !next }))
      setError("Couldn't save that. Try again.")
    }
  }

  return (
    <div className="space-y-1">
      <ul className="divide-y divide-border border-y border-border">
        {ROWS.map((r) => (
          <li key={r.key}>
            <label className="flex items-center gap-3 py-3 cursor-pointer">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground leading-snug">{r.hint}</span>
              </span>
              <input type="checkbox" role="switch" checked={prefs[r.key]} onChange={() => flip(r.key)} className="sr-only peer" />
              <span aria-hidden className="relative shrink-0 w-11 h-6 rounded-full bg-cool-2 transition-colors peer-checked:bg-heat peer-focus-visible:ring-2 peer-focus-visible:ring-ring after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-background after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
