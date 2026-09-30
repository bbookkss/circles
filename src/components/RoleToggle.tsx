'use client'

import { useState } from 'react'
import { setMemberRole } from '@/app/actions/members'

/**
 * "Make admin" / "Remove admin", shown to admins on the member list.
 *
 * The reason this exists is not parity with anybody. A recurring group dies
 * when its organiser gets tired, and until now a circle had exactly one admin
 * and no way to add another. `leaveCircle` even told a sole admin to "make
 * someone else an admin before you leave", which was impossible.
 */
export default function RoleToggle({
  circleId,
  userId,
  name,
  isAdmin,
}: {
  circleId: string
  userId: string
  name: string
  isAdmin: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (busy) return
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('circle_id', circleId)
    fd.set('user_id', userId)
    fd.set('role', isAdmin ? 'member' : 'admin')
    const res = await setMemberRole(fd)
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        title={isAdmin ? `Remove ${name} as an admin` : `Make ${name} an admin`}
        className="min-h-9 px-3 rounded-full border border-border text-xs hover:border-foreground hover:bg-muted disabled:opacity-40 transition-colors whitespace-nowrap"
      >
        {busy ? '…' : isAdmin ? 'Remove admin' : 'Make admin'}
      </button>
      {error && <span className="text-[11px] text-destructive mt-1 max-w-[180px] text-right">{error}</span>}
    </span>
  )
}
