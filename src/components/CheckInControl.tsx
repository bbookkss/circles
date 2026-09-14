'use client'

import { useState } from 'react'
import { setCheckIn, clearCheckIn } from '@/app/actions/checkins'

type Status = 'yes' | 'no' | 'maybe'

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'yes', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: "Can't" },
]

/**
 * Three pills. Only one colour on the page means anything, and this is where
 * it lives: a chosen answer fills in pen-blue. "Can't", once chosen, is
 * struck through rather than filled, because it is the one answer that is
 * not a commitment to be somewhere.
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
      <div className="flex gap-2 flex-wrap">
        {OPTIONS.map((o) => {
          const on = status === o.value
          const cls = disabled
            ? 'border-border text-muted-foreground'
            : on
              ? o.value === 'no'
                ? 'border-border text-muted-foreground line-through'
                : 'bg-pen border-pen text-white'
              : 'border-foreground text-foreground hover:bg-muted'
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              disabled={pending || disabled}
              aria-pressed={on}
              title={disabled ? disabledReason : undefined}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${cls} ${disabled ? 'cursor-default' : ''}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {disabled && disabledReason && (
        <p className="label normal-case tracking-normal">{disabledReason}</p>
      )}
    </div>
  )
}
