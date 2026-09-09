'use client'

import { useState } from 'react'
import { setCheckIn, clearCheckIn } from '@/app/actions/checkins'

type Status = 'yes' | 'no' | 'maybe'

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'yes', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: "Can't" },
]

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
      <div className="flex gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={pending || disabled}
            title={disabled ? disabledReason : undefined}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              status === o.value
                ? 'bg-foreground text-background border-foreground'
                : 'border-input hover:bg-muted'
            } ${disabled ? 'opacity-50 cursor-default' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
