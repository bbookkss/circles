'use client'

import { useState } from 'react'
import { setCheckIn, clearCheckIn } from '@/app/actions/checkins'

type Status = 'yes' | 'no' | 'maybe'

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'yes', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: "Can't go" },
]

/**
 * One segmented control. Heat is the only colour on the page that means
 * anything, and this is where it lives: Going, once chosen, fills gold.
 * Maybe and Can't go, once chosen, go to plain paper: an answer, but not a
 * commitment to be somewhere.
 */
export default function CheckInControl({
  circleId,
  occursOn,
  initialStatus,
  disabled = false,
  disabledReason,
}: {
  circleId: string
  occursOn: string
  initialStatus: Status | null
  disabled?: boolean
  disabledReason?: string
}) {
  const [status, setStatus] = useState<Status | null>(initialStatus)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(next: Status) {
    if (pending || disabled) return
    const previous = status
    // Tapping the current answer clears it.
    const clearing = previous === next
    setStatus(clearing ? null : next)
    setPending(true)
    setError(null)

    const fd = new FormData()
    fd.set('circle_id', circleId)
    fd.set('occurs_on', occursOn)
    if (!clearing) fd.set('status', next)

    const result = clearing ? await clearCheckIn(fd) : await setCheckIn(fd)
    if (result?.error) {
      setStatus(previous)
      setError(result.error)
    }
    setPending(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="inline-flex gap-0.5 p-[3px] rounded-full bg-muted" role="group" aria-label="Are you going?">
        {OPTIONS.map((o) => {
          const on = status === o.value
          const cls = on
            ? o.value === 'yes'
              ? 'bg-heat text-[#1a2230]'
              : 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              disabled={pending || disabled}
              aria-pressed={on}
              title={disabled ? disabledReason : undefined}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${cls} ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {disabled && disabledReason && (
        <p className="text-sm text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
