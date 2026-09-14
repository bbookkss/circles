'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { sendFeedback } from '@/app/actions/feedback'

/**
 * A small floating "Feedback" tag on every signed-in page.
 *
 * Bottom right, lifted above where Mapbox puts its attribution so the two
 * never overlap on the explore and create pages. The panel is deliberately
 * one box and one button: a pilot user who has just hit something odd
 * should be able to say so in the time it takes to lose the thought.
 */
export default function FeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || state === 'sending') return
    setState('sending')
    setError(null)
    const fd = new FormData()
    fd.set('message', message)
    fd.set('page', pathname ?? '')
    const res = await sendFeedback(fd)
    if ('error' in res) {
      setState('error')
      setError(res.error)
      return
    }
    setState('sent')
    setMessage('')
    // Fold away on its own; the sent note has been seen by then.
    setTimeout(() => {
      setOpen(false)
      setState('idle')
    }, 1800)
  }

  return (
    <div className="fixed right-4 bottom-10 md:bottom-6 z-40 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <form
          onSubmit={submit}
          className="w-[min(320px,calc(100vw-2rem))] bg-background border border-foreground shadow-[0_10px_30px_-12px_rgba(34,31,27,0.45)] p-4 space-y-3 fade-rise"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display font-semibold text-lg leading-tight">Tell Ben</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="label hover:text-foreground"
              aria-label="Close"
            >
              close
            </button>
          </div>
          <p className="text-xs text-foreground/75">
            Anything: a bug, something confusing, something you wish it did. It goes straight to his inbox and he can reply to you.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={4000}
            autoFocus
            placeholder="What happened, or what would help?"
            className="w-full border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-pen resize-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="label">{state === 'sent' ? 'sent. thank you.' : pathname}</span>
            <button
              type="submit"
              disabled={state === 'sending' || !message.trim()}
              className="text-sm font-medium rounded-full border border-foreground px-4 py-1.5 hover:bg-pen hover:border-pen hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground disabled:hover:border-foreground transition-colors"
            >
              {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Send'}
            </button>
          </div>
        </form>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-display font-semibold text-sm rounded-full px-3.5 py-2 bg-background border border-foreground shadow-[0_2px_8px_-2px_rgba(34,31,27,0.35)] hover:-translate-y-0.5 transition-transform"
      >
        {open ? 'Close' : 'Feedback'}
      </button>
    </div>
  )
}
