'use client'

import { useState } from 'react'
import { recordAttendance } from '@/app/actions/attendance'

type Person = { user_id: string; full_name: string; attended: boolean | null }

/**
 * "Who made it?" for the meet that just finished.
 *
 * Shown to members once a meet is over, and only while somebody who said yes
 * has not been accounted for. The list starts with everyone who said yes
 * already ticked, because the common case is that the people who said they
 * were coming came; the work is in unticking the one who did not, which takes
 * a second rather than a minute.
 *
 * This is the only thing standing behind "shows up 11 of 12", so it is
 * deliberately light. A register that feels like homework does not get filed,
 * and an unfiled register makes the number meaningless.
 */
export default function AttendanceRegister({
  circleId,
  occursOn,
  dateLabel,
  people,
  alreadyFiled,
}: {
  circleId: string
  occursOn: string
  dateLabel: string
  people: Person[]
  alreadyFiled: boolean
}) {
  const [here, setHere] = useState<Set<string>>(
    () => new Set(people.filter((p) => p.attended !== false).map((p) => p.user_id))
  )
  const [open, setOpen] = useState(!alreadyFiled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggle(id: string) {
    setHere((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    const fd = new FormData()
    fd.set('circle_id', circleId)
    fd.set('occurs_on', occursOn)
    for (const p of people) {
      fd.append(here.has(p.user_id) ? 'attended' : 'absent', p.user_id)
    }
    const res = await recordAttendance(fd)
    setSaving(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setDone(true)
    setOpen(false)
  }

  const cameCount = here.size

  if (!open) {
    return (
      <div className="border border-border p-4 flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/80">
          <span className="font-display font-semibold">{dateLabel}</span>
          {': '}
          {cameCount} of {people.length} made it.
          {done && <span className="text-pen"> Thanks.</span>}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="label hover:text-foreground underline underline-offset-4"
        >
          change
        </button>
      </div>
    )
  }

  return (
    <div className="border border-foreground p-4 space-y-3">
      <div>
        <p className="label">Last meet · {dateLabel}</p>
        <p className="font-display font-semibold text-lg mt-0.5">Who made it?</p>
        <p className="text-xs text-foreground/75 mt-1">
          Untick anyone who said they were coming and did not. This is what
          &ldquo;shows up&rdquo; on a profile is counted from.
        </p>
      </div>

      <ul className="divide-y divide-border/70 border-t border-b border-border/70">
        {people.map((p) => {
          const on = here.has(p.user_id)
          return (
            <li key={p.user_id}>
              <button
                type="button"
                onClick={() => toggle(p.user_id)}
                aria-pressed={on}
                className="w-full flex items-center gap-3 py-2.5 text-left"
              >
                <span
                  aria-hidden
                  className={`w-4 h-4 border flex items-center justify-center text-[10px] leading-none flex-shrink-0 ${
                    on ? 'bg-pen border-pen text-white' : 'border-foreground text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className={`text-sm flex-1 min-w-0 truncate ${on ? '' : 'text-muted-foreground line-through'}`}>
                  {p.full_name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <span className="label">{cameCount} of {people.length} here</span>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm font-medium rounded-full border border-foreground px-4 py-1.5 hover:bg-pen hover:border-pen hover:text-white disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
