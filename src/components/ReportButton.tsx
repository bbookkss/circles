'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { fileReport } from '@/app/actions/safety'
import { REPORT_REASONS, type ReportTarget } from '@/lib/reports'

const NOUN: Record<ReportTarget, string> = {
  user: 'this person',
  post: 'this post',
  comment: 'this comment',
  circle: 'this circle',
}

/**
 * A quiet "report" link that opens a small sheet: a reason, an optional
 * note, send. The database checks the reporter can see what they are
 * reporting and keeps a copy of it, so nothing here needs to be trusted.
 */
export default function ReportButton({
  targetType,
  targetId,
  className = 'text-muted-foreground hover:text-destructive transition-colors',
  label = 'report',
}: {
  targetType: ReportTarget
  targetId: string
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setReason('')
    setDetails('')
    setState('idle')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason || state === 'sending') return
    setState('sending')
    setError(null)
    const fd = new FormData()
    fd.set('target_type', targetType)
    fd.set('target_id', targetId)
    fd.set('reason', reason)
    fd.set('details', details)
    const res = await fileReport(fd)
    if ('error' in res) {
      setState('idle')
      setError(res.error)
      return
    }
    setState('sent')
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {/* Portalled to body: a transformed ancestor (.fade-rise) would
          otherwise become the containing block for position: fixed. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-foreground/30 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Report ${NOUN[targetType]}`}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-background border border-foreground shadow-[0_10px_30px_-12px_rgba(34,31,27,0.45)] p-5 space-y-4 text-left fade-rise"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-semibold text-lg leading-tight">Report {NOUN[targetType]}</p>
              <button
                type="button"
                onClick={close}
                className="min-h-9 px-2 -mr-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            {state === 'sent' ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Thanks. It has been sent for review, and nobody is told who reported it.
                </p>
                {targetType !== 'circle' && (
                  <p className="text-xs text-foreground/75">
                    If you do not want to hear from them at all, you can also block them from their profile.
                  </p>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="text-sm font-medium rounded-full border border-foreground px-4 py-1.5 hover:bg-muted transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <fieldset className="space-y-1.5">
                  <legend className="text-xs text-foreground/75 mb-2">What is wrong with it?</legend>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2.5 text-sm min-h-9 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-pen"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Anything that would help (optional)"
                  className="w-full border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-pen resize-none"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!reason || state === 'sending'}
                    className="text-sm font-medium rounded-full border border-foreground px-4 py-1.5 hover:bg-destructive hover:border-destructive hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground disabled:hover:border-foreground transition-colors"
                  >
                    {state === 'sending' ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>,
        document.body
      )}
    </>
  )
}
