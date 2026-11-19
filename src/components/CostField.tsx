'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'

/**
 * Free or paid, for the create and edit forms. Posts `is_free` ("true",
 * "false", or "" for not said) and, when paid, a short `price_note` like
 * "$7 cover". The map tints paid circles and marks them with $; free is the
 * plain default.
 */
export default function CostField({ initialFree = null, initialNote = '' }: { initialFree?: boolean | null; initialNote?: string | null }) {
  const [free, setFree] = useState<boolean | null>(initialFree)
  const [note, setNote] = useState(initialNote ?? '')
  return (
    <div className="space-y-2">
      <Label>Cost to come</Label>
      <input type="hidden" name="is_free" value={free === null ? '' : String(free)} />
      <div className="flex gap-2">
        {([[true, 'Free'], [false, 'Costs something']] as const).map(([v, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setFree(free === v ? null : v)}
            aria-pressed={free === v}
            className={`flex-1 py-2 rounded-full text-sm font-medium border transition-colors ${
              free === v ? 'bg-foreground text-background border-foreground' : 'bg-muted text-foreground border-transparent hover:bg-cool-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {free === false && (
        <input
          name="price_note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={60}
          placeholder="How much? For example, $7 cover"
          className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm outline-none focus:bg-background focus:ring-3 focus:ring-muted border border-transparent focus:border-ring"
        />
      )}
      <p className="text-xs text-muted-foreground">Paid circles show a $ on the map, with what it costs.</p>
    </div>
  )
}
