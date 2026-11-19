'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useRouter } from 'next/navigation'
import { setCheckIn, clearCheckIn } from '@/app/actions/checkins'
import { scheduleCheckIn, cancelScheduledCheckIn } from '@/app/actions/scheduled'
import MapThumb from '@/components/MapThumb'
import { useNearMe, nearLabel } from '@/components/useNearMe'
import type { Card, Meet, Status } from '@/lib/ai/tools/assistant/types'

/**
 * Radius ("Ask Radius"): the signed-in assistant's panel. See docs/agents/assistant.md.
 *
 * The assistant never answers for anyone. Every meet it brings up is a card
 * with its own Going / Maybe / Can't go buttons, its suggestion (if any)
 * marked with a dashed outline, and a chip saying exactly where things stand:
 * not answered, suggested and not sent, sent, or scheduled. Only a tap on one
 * of those buttons calls an action, and every tap can be undone.
 *
 * Everything here renders as plain text. Links are built from IDs, never
 * taken from the model.
 *
 * The conversation is kept in sessionStorage, so it survives moving between
 * pages (this component remounts with TopNav on each one). It is rendered
 * client-only (AskCirclesLoader), so reading sessionStorage while setting up
 * state can't disagree with server HTML.
 */

type Turn = { role: 'user' | 'assistant'; text: string; cards?: Card[]; error?: boolean }
type RsvpState = { status: Status | null; scheduled: Status | null; prev?: { status: Status | null; scheduled: Status | null }; busy?: boolean; error?: string }

const STORE = 'ask-circles:v1'
const WORD: Record<Status, string> = { yes: 'going', no: "can't go", maybe: 'maybe' }
const LABEL: Record<Status, string> = { yes: 'Going', maybe: 'Maybe', no: "Can't go" }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const keyOf = (m: Meet) => `${m.circle_id}|${m.occurs_on}`

function load(): { turns: Turn[]; open: boolean } {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) || 'null')
    if (v && Array.isArray(v.turns)) return { turns: v.turns.slice(-30), open: !!v.open }
  } catch {}
  return { turns: [], open: false }
}

/** The logo ring; it spins up while a request is in flight (Logo's busy prop). */
function Ring({ spinning = false }: { spinning?: boolean }) {
  return (
    <span className="shrink-0">
      <Logo size={18} busy={spinning} />
    </span>
  )
}

export default function AskCircles() {
  const router = useRouter()
  const [open, setOpen] = useState(() => load().open)
  // Tell the Feedback button the panel is open, so it hides instead of sitting
  // under the panel (globals.css, data-ask-open).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-ask-open', open)
    return () => document.documentElement.removeAttribute('data-ask-open')
  }, [open])
  const [turns, setTurns] = useState<Turn[]>(() => load().turns)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { near, status: nearStatus, ask: askNear, forget: forgetNear } = useNearMe()
  const [rsvp, setRsvp] = useState<Record<string, RsvpState>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ turns: turns.slice(-30), open })) } catch {}
  }, [turns, open])

  useEffect(() => {
    if (!open) return
    let live = true
    fetch('/api/assistant', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && Array.isArray(d.suggestions)) setSuggestions(d.suggestions.slice(0, 4)) })
      .catch(() => {})
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { live = false; window.removeEventListener('keydown', onKey) }
  }, [open])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [turns, busy])

  async function ask(q: string) {
    const message = q.trim().slice(0, 500)
    if (!message || busy) return
    const history = turns.filter((t) => !t.error).map((t) => ({ role: t.role, text: t.text })).slice(-16)
    setTurns((t) => [...t, { role: 'user', text: message }])
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, near }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTurns((t) => [...t, { role: 'assistant', text: typeof data.error === 'string' ? data.error : 'Something went wrong. Try again.', error: true }])
      } else {
        setTurns((t) => [...t, { role: 'assistant', text: String(data.text ?? ''), cards: Array.isArray(data.cards) ? data.cards : [] }])
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions.slice(0, 4))
      }
    } catch {
      setTurns((t) => [...t, { role: 'assistant', text: "Couldn't reach the assistant. Check your connection.", error: true }])
    } finally {
      setBusy(false)
    }
  }

  /** The person's tap. The only path from this panel to a write. */
  async function answer(meet: Meet, s: Status) {
    const k = keyOf(meet)
    const cur = rsvp[k] ?? { status: meet.my_status, scheduled: meet.scheduled_status }
    if (cur.busy) return
    if (meet.open ? cur.status === s : cur.scheduled === s) return
    setRsvp((r) => ({ ...r, [k]: { ...cur, busy: true, error: undefined } }))
    const res = meet.open ? await setCheckIn(form(meet, s)) : await scheduleCheckIn(meet.circle_id, meet.occurs_on, s)
    setRsvp((r) => ({
      ...r,
      [k]: 'error' in res && res.error
        ? { ...cur, busy: false, error: "Couldn't send that. Try again." }
        : {
            status: meet.open ? s : cur.status,
            scheduled: meet.open ? cur.scheduled : s,
            prev: { status: cur.status, scheduled: cur.scheduled },
          },
    }))
    if (!('error' in res && res.error)) router.refresh()
  }

  async function undo(meet: Meet) {
    const k = keyOf(meet)
    const cur = rsvp[k]
    if (!cur?.prev || cur.busy) return
    setRsvp((r) => ({ ...r, [k]: { ...cur, busy: true, error: undefined } }))
    const p = cur.prev
    const res = meet.open
      ? p.status ? await setCheckIn(form(meet, p.status)) : await clearCheckIn(form(meet, null))
      : p.scheduled ? await scheduleCheckIn(meet.circle_id, meet.occurs_on, p.scheduled) : await cancelScheduledCheckIn(meet.circle_id, meet.occurs_on)
    setRsvp((r) => ({
      ...r,
      [k]: 'error' in res && res.error ? { ...cur, busy: false, error: "Couldn't undo that. Try again." } : { status: p.status, scheduled: p.scheduled },
    }))
    if (!('error' in res && res.error)) router.refresh()
  }

  const last = turns[turns.length - 1]

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="ask-circles"
          className="ask-trigger fixed z-40 right-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-[4.75rem] h-11 rounded-full glass text-foreground pl-3.5 pr-4 flex items-center gap-2 text-sm font-medium hover:bg-background/70 transition-colors print:hidden"
        >
          <Ring />
          <span className="max-md:sr-only">Ask Radius</span>
        </button>
      )}

      {open && (
        <section
          id="ask-circles"
          role="dialog"
          aria-label="Radius, your Circles assistant"
          className="fixed z-50 inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-4 md:bottom-6 md:w-[420px] h-[min(660px,calc(100dvh-7rem))] glass rounded-[26px] overflow-hidden flex flex-col print:hidden"
        >
          <header className="flex items-center gap-2.5 pl-5 pr-3 h-14 shrink-0">
            <Ring spinning={busy} />
            <p className="font-medium leading-none">Radius</p>
            <button
              type="button"
              onClick={() => { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0) }}
              className="ml-auto min-h-9 px-3 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Close
            </button>
          </header>

          <div ref={logRef} aria-live="polite" className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-1 space-y-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-[0.95rem] text-muted-foreground">
                  Ask about your week, your messages, or circles anywhere. I&apos;ll lay out the options and you choose.
                </p>
                <Chips items={suggestions} onPick={ask} />
              </div>
            )}

            {turns.map((t, i) =>
              t.role === 'user' ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] bg-foreground text-background px-3.5 py-2 rounded-[18px_18px_6px_18px] text-[0.95rem] whitespace-pre-wrap break-words">
                  {t.text}
                </p>
              ) : (
                <div key={i} className="space-y-2">
                  <p className={`text-[0.95rem] whitespace-pre-wrap break-words ${t.error ? 'text-muted-foreground' : ''}`}>{t.text}</p>
                  {(t.cards ?? []).length > 0 && (
                    <ul className="space-y-2">
                      {(t.cards ?? []).map((c, j) => (
                        <li key={j}>
                          <CardView
                            card={c}
                            rsvp={c.kind === 'meet' || c.kind === 'proposal' ? rsvp[keyOf(c.meet)] : undefined}
                            onAnswer={answer}
                            onUndo={undo}
                            onNavigate={(href) => router.push(href)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            )}

            {busy && <p className="text-sm text-muted-foreground flex items-center gap-2.5"><span className="text-foreground"><Logo size={16} busy /></span>Looking…</p>}
            {!busy && last?.role === 'assistant' && suggestions.length > 0 && <Chips items={suggestions.slice(0, 3)} onPick={ask} />}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input) }}
            className="shrink-0 m-2.5 mt-0 p-1.5 pl-2 rounded-[20px] bg-background flex gap-2 items-center"
          >
            {/* Location: off until tapped; the browser asks, and only a rounded
                position (about 1 km) is sent. Gold while it's in use. */}
            <button
              type="button"
              onClick={nearStatus === 'on' ? forgetNear : askNear}
              disabled={nearStatus === 'asking'}
              aria-pressed={nearStatus === 'on'}
              aria-label={nearStatus === 'on' ? 'Stop using your location' : nearLabel(nearStatus)}
              title={nearLabel(nearStatus)}
              className={`w-9 h-9 shrink-0 grid place-items-center rounded-full transition-colors ${nearStatus === 'on' ? 'bg-heat text-[#1a2230]' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
            </button>
            <label htmlFor="ask-circles-input" className="sr-only">Ask Radius</label>
            <input
              id="ask-circles-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder="Ask about your circles"
              className="flex-1 min-w-0 bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium disabled:opacity-35"
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  )
}

function form(meet: Meet, s: Status | null) {
  const fd = new FormData()
  fd.set('circle_id', meet.circle_id)
  fd.set('occurs_on', meet.occurs_on)
  if (s) fd.set('status', s)
  return fd
}

function Chips({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="text-left text-sm px-3.5 py-2 rounded-full bg-muted hover:bg-cool-2 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  )
}

function CardView({
  card, rsvp, onAnswer, onUndo, onNavigate,
}: {
  card: Card
  rsvp?: RsvpState
  onAnswer: (m: Meet, s: Status) => void
  onUndo: (m: Meet) => void
  onNavigate: (href: string) => void
}) {
  if (card.kind === 'meet' || card.kind === 'proposal') {
    return <MeetCard meet={card.meet} suggested={card.kind === 'proposal' ? card.suggested : null} state={rsvp} onAnswer={onAnswer} onUndo={onUndo} />
  }
  if (card.kind === 'message') {
    return (
      <div className="rounded-2xl bg-muted p-3.5 space-y-1">
        <p className="text-sm flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{card.from_name}</span>
          <span className="text-xs text-muted-foreground">{new Date(card.sent_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          {card.unread && <span className="text-xs text-pen font-medium">New</span>}
        </p>
        <p className="text-sm whitespace-pre-wrap break-words">{card.text}</p>
        <Link href={`/messages/${encodeURIComponent(card.from_id)}`} className="inline-block text-sm underline underline-offset-4 decoration-1 decoration-cool-2 hover:decoration-foreground">
          Open conversation
        </Link>
      </div>
    )
  }
  if (card.kind === 'circle') {
    return (
      <Link href={`/circles/${encodeURIComponent(card.circle_id)}`} className="flex gap-3 rounded-2xl bg-muted p-2 pr-3 hover:bg-cool-2 transition-colors">
        {card.thumb && <MapThumb lat={card.thumb.lat} lng={card.thumb.lng} exact={card.thumb.exact} label={card.name} />}
        <span className="min-w-0 text-sm">
          <span className="block font-medium truncate">{card.emoji ? `${card.emoji} ` : ''}{card.name}</span>
          <span className="block text-muted-foreground truncate">
            {[card.neighborhood, card.days.length ? card.days.map((d) => DAYS[d]).join(', ') : null].filter(Boolean).join(', ')}
          </span>
          <span className="block text-muted-foreground">
            {card.member_count} member{card.member_count === 1 ? '' : 's'}{card.is_member ? ', including you' : ''}
          </span>
        </span>
      </Link>
    )
  }
  // navigate
  const href = `/explore?lat=${card.lat.toFixed(5)}&lng=${card.lng.toFixed(5)}&zoom=${card.zoom}`
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className="w-full text-left rounded-2xl bg-muted p-3.5 hover:bg-cool-2 transition-colors text-sm"
    >
      Open the map at <span className="font-medium">{card.label}</span>
    </button>
  )
}

function MeetCard({
  meet, suggested, state, onAnswer, onUndo,
}: {
  meet: Meet
  suggested: Status | null
  state?: RsvpState
  onAnswer: (m: Meet, s: Status) => void
  onUndo: (m: Meet) => void
}) {
  const status = state ? state.status : meet.my_status
  const scheduled = state ? state.scheduled : meet.scheduled_status
  const current = meet.open ? status : scheduled ?? status
  const showSuggestion = suggested && current !== suggested

  return (
    <div className="flex gap-3 rounded-2xl bg-muted p-2 pr-3">
      {meet.thumb && <MapThumb lat={meet.thumb.lat} lng={meet.thumb.lng} exact={meet.thumb.exact} label={meet.circle_name} />}
      <div className="min-w-0 flex-1 text-sm space-y-1.5">
        <p>
          <Link href={`/circles/${encodeURIComponent(meet.circle_id)}`} className="font-medium hover:underline underline-offset-4">
            {meet.emoji ? `${meet.emoji} ` : ''}{meet.circle_name}
          </Link>
          <span className="text-muted-foreground">, {meet.day_label}, {meet.time_label}</span>
        </p>
        {meet.venue && <p className="text-muted-foreground truncate">{meet.venue}</p>}
        <p className="text-muted-foreground">
          {meet.open ? <span className="text-pen font-medium">Check-in open. </span> : `Check-in opens ${meet.opens_label}. `}
          {meet.going.length ? `${meet.going.slice(0, 3).join(', ')}${meet.going.length > 3 ? ` and ${meet.going.length - 3} more` : ''} ${meet.going.length === 1 ? 'is' : 'are'} in.` : 'Nobody has said yes yet.'}
        </p>

        <p className="flex flex-wrap gap-1.5">
          {meet.open && status ? (
            <Chip tone="sent"><Tick />Sent: {WORD[status]}</Chip>
          ) : !meet.open && scheduled ? (
            <Chip tone="scheduled">Scheduled: {WORD[scheduled]}. Sends {meet.opens_label}.</Chip>
          ) : status ? (
            <Chip tone="sent"><Tick />Sent: {WORD[status]}</Chip>
          ) : (
            <Chip tone="none">Not answered</Chip>
          )}
          {showSuggestion && <Chip tone="suggested">Suggested: {WORD[suggested]}. Not sent.</Chip>}
        </p>

        <div role="group" aria-label={`Your answer for ${meet.circle_name}`} className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {(['yes', 'maybe', 'no'] as Status[]).map((s) => {
            const pressed = current === s
            const isSuggested = showSuggestion && suggested === s
            return (
              <button
                key={s}
                type="button"
                disabled={state?.busy}
                aria-pressed={pressed}
                onClick={() => onAnswer(meet, s)}
                className={[
                  'h-8 px-3.5 rounded-full text-[0.8rem] font-medium border transition-colors disabled:opacity-50',
                  pressed
                    ? s === 'yes' ? 'bg-heat text-[#1a2230] border-heat' : 'bg-foreground text-background border-foreground'
                    : isSuggested ? 'bg-background border-dashed border-foreground' : 'bg-background border-transparent hover:border-cool-2',
                ].join(' ')}
              >
                {LABEL[s]}
              </button>
            )
          })}
          {state?.prev && (
            <button type="button" disabled={state.busy} onClick={() => onUndo(meet)} className="h-8 px-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Undo
            </button>
          )}
        </div>
        {!meet.open && <p className="text-xs text-muted-foreground">Check-in isn&apos;t open yet. A tap is saved and sent {meet.opens_label}.</p>}
        {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
    </div>
  )
}

function Chip({ tone, children }: { tone: 'none' | 'sent' | 'scheduled' | 'suggested'; children: React.ReactNode }) {
  const cls = {
    none: 'bg-background text-muted-foreground',
    sent: 'bg-foreground text-background',
    scheduled: 'bg-cool-2 text-foreground',
    suggested: 'border border-dashed border-muted-foreground text-foreground',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
