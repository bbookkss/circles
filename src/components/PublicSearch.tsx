'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * "What do you want to find?" for signed-out visitors. Calls /api/find.
 *
 * Everything shown is plain text from the response: one sentence, and circles
 * built from database rows on the server. No HTML from the server is ever
 * rendered. Exact places are never sent; that's what the account is for.
 *
 * The Turnstile bot check loads only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * set. Without it a null token is sent, which the server accepts only
 * outside production.
 */

type Circle = {
  id: string
  name: string
  category: string | null
  neighborhood: string | null
  city: string | null
  days: number[]
  members: number
  km: number | null
}

type Result = { sentence: string; circles: Circle[] }

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const EXAMPLES = ['pickup basketball', 'a choir', 'weekend hikes']

function daysText(days: number[]) {
  const names = days.map((d) => DAYS[d]).filter(Boolean)
  if (names.length <= 1) return names.join('')
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

export default function PublicSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<{ text: string; signup: boolean } | null>(null)
  const widgetEl = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const token = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    const mount = () => {
      if (!window.turnstile || !widgetEl.current || widgetId.current) return
      widgetId.current = window.turnstile.render(widgetEl.current, {
        sitekey: SITE_KEY,
        appearance: 'interaction-only',
        callback: (t: string) => { token.current = t },
        'expired-callback': () => { token.current = null },
        'error-callback': () => { token.current = null },
      })
    }
    if (window.turnstile) return mount()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = mount
    document.head.appendChild(s)
  }, [])

  async function search(q: string) {
    const text = q.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, turnstileToken: token.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError({
          text: typeof data.error === 'string' ? data.error : "Search isn't working right now. Try again in a minute.",
          signup: Boolean(data.signup),
        })
      } else {
        setResult({
          sentence: typeof data.sentence === 'string' ? data.sentence : '',
          circles: Array.isArray(data.circles) ? data.circles : [],
        })
      }
    } catch {
      setError({ text: "Search isn't working right now. Try again in a minute.", signup: false })
    } finally {
      setLoading(false)
      // A Turnstile token is single-use.
      token.current = null
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    }
  }

  return (
    <div className="mt-8 max-w-md">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); search(query) }}
      >
        <label htmlFor="public-search" className="sr-only">What do you want to find?</label>
        <Input
          id="public-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to find?"
          maxLength={120}
          autoComplete="off"
          className="h-10 rounded-full px-4 bg-card"
        />
        <Button type="submit" size="lg" className="rounded-full" disabled={loading || !query.trim()}>
          Search
        </Button>
      </form>

      {!result && !error && !loading && (
        <p className="text-sm text-muted-foreground mt-3">
          Try{' '}
          {EXAMPLES.map((ex, i) => (
            <span key={ex}>
              <button
                type="button"
                className="underline underline-offset-4 decoration-pen-soft hover:text-foreground"
                onClick={() => { setQuery(ex); search(ex) }}
              >
                {ex}
              </button>
              {i < EXAMPLES.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}

      <div ref={widgetEl} className="mt-2" />

      <div aria-live="polite" className="mt-4 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Searching public circles…</p>}

        {error && (
          <div className="space-y-2">
            <p className="text-sm">{error.text}</p>
            {error.signup && (
              <Link href="/signup" className="text-sm underline underline-offset-4 decoration-pen-soft">
                Create a free account
              </Link>
            )}
          </div>
        )}

        {result && (
          <>
            {result.sentence && <p>{result.sentence}</p>}
            {result.circles.length > 0 && (
              <ul className="divide-y divide-border border-y border-border">
                {result.circles.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-foreground/75">
                      {[c.neighborhood ?? c.city, daysText(c.days), c.members ? `${c.members} members` : null]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-sm text-foreground/75 flex-1 min-w-[14rem]">
                Make a free account to see exactly where they meet and who&apos;s going this week.
              </p>
              <Link href="/signup">
                <Button size="sm" className="rounded-full">Create an account</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
