'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { blockUser } from '@/app/actions/safety'

/**
 * Two taps, because a block quietly cuts several things at once and the
 * person deserves to know what before it happens.
 */
export default function BlockButton({ userId, name }: { userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function block() {
    setPending(true)
    setError(null)
    const fd = new FormData()
    fd.set('user_id', userId)
    const res = await blockUser(fd)
    setPending(false)
    if ('error' in res) setError(res.error)
    else setConfirming(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-destructive transition-colors"
      >
        block
      </button>

      {/* Portalled to body: a transformed ancestor (.fade-rise) would
          otherwise become the containing block for position: fixed. */}
      {confirming && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-foreground/30 p-4"
          onClick={() => setConfirming(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Block ${name}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-background border border-foreground shadow-[0_10px_30px_-12px_rgba(34,31,27,0.45)] p-5 space-y-4 text-left text-sm fade-rise"
          >
            <p className="font-display font-semibold text-lg leading-tight">Block {name}?</p>
            <p>
              Neither of you will be able to message or follow the other, and you will stop seeing
              each other&apos;s posts and comments. They are not told. You both stay in any circle
              you share.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-border px-4 py-1.5 hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={block}
                disabled={pending}
                className="font-medium rounded-full border border-destructive text-destructive px-4 py-1.5 hover:bg-destructive hover:text-white disabled:opacity-40 transition-colors"
              >
                {pending ? 'Blocking…' : 'Block'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
