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

/**
 * A conversation is a session: after 15 minutes without the person sending
 * anything, Radius starts fresh. Old turns would otherwise ride along as
 * context into an unrelated question an hour later, and a stale "you haven't
 * answered" card is worse than none.
 */
const IDLE_MS = 15 * 60 * 1000
const stale = (lastAt: number | null) => lastAt !== null && Date.now() - lastAt > IDLE_MS

function load(): { turns: Turn[]; open: boolean; lastAt: number | null } {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) || 'null')
    const lastAt = typeof v?.lastAt === 'number' ? v.lastAt : null
    if (v && Array.isArray(v.turns) && !stale(lastAt)) return { turns: v.turns.slice(-30), open: !!v.open, lastAt }
  } catch {}
  return { turns: [], open: false, lastAt: null }
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
  // When the person last sent something; the 15-minute clock runs from here.
  const lastAt = useRef<number | null>(load().lastAt)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { near, status: nearStatus, ask: askNear, forget: forgetNear } = useNearMe()
  const [rsvp, setRsvp] = useState<Record<string, RsvpState>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ turns: turns.slice(-30), open, lastAt: lastAt.current })) } catch {}
  }, [turns, open])

  useEffect(() => {
    if (!open) return
    // Reopened after a long quiet spell in the same tab: start fresh.
    if (stale(lastAt.current)) {
      lastAt.current = null
      setTurns([])
    }
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
    // Left open and quiet for 15 minutes, then typed into: this is a new
    // conversation, so none of the old one goes to the model.
    const fresh = stale(lastAt.current)
    const history = fresh ? [] : turns.filter((t) => !t.error).map((t) => ({ role: t.role, text: t.text })).slice(-16)
    lastAt.current = Date.now()
    setTurns((t) => [...(fresh ? [] : t), { role: 'user', text: message }])
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
          // Solid ink with a real shadow, not glass: over a dark list, frosted
          // glass blended into the rows beneath it.
          className="ask-trigger fixed z-40 right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-[4.75rem] h-12 w-12 md:w-auto rounded-full bg-foreground text-background md:pl-3.5 md:pr-4 flex items-center justify-center gap-2 text-sm font-medium shadow-[0_6px_20px_rgba(0,0,0,0.28)] ring-1 ring-background/20 hover:opacity-90 transition-opacity print:hidden"
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
          // Phones: pinned between the nav and the tab bar, so its header never
          // slides up under the nav however short the screen. Desktop: a panel
          // in the corner.
          className="fixed z-50 inset-x-2 top-[calc(4.25rem+env(safe-area-inset-top))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:top-auto md:inset-x-auto md:right-4 md:bottom-6 md:w-[420px] md:h-[min(660px,calc(100dvh-7rem))] glass rounded-[26px] overflow-hidden flex flex-col print:hidden"
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
                    <ul className="space-y-1.5">
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
      <Link href={`/messages/${encodeURIComponent(card.from_id)}`} className="block rounded-xl bg-muted px-3 py-2 hover:bg-cool-2 transition-colors text-sm">
        <span className="flex items-baseline gap-2">
          <span className="font-medium truncate">{card.from_name}</span>
          {card.unread && <span className="text-xs text-pen font-medium">New</span>}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(card.sent_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
        </span>
        <span className="block text-muted-foreground line-clamp-2 break-words">{card.text}</span>
      </Link>
    )
  }
  if (card.kind === 'circle') {
    const meta = [
      card.neighborhood,
      card.days.length ? card.days.map((d) => DAYS[d]).join(', ') : null,
      `${card.member_count} member${card.member_count === 1 ? '' : 's'}`,
    ].filter(Boolean).join(', ')
    return (
      <Link href={`/circles/${encodeURIComponent(card.circle_id)}`} className="flex items-center gap-2.5 rounded-xl bg-muted p-1.5 pr-3 hover:bg-cool-2 transition-colors">
        {card.thumb && <MapThumb small lat={card.thumb.lat} lng={card.thumb.lng} exact={card.thumb.exact} label={card.name} />}
        <span className="min-w-0 flex-1 text-sm leading-snug">
          <span className="block font-medium truncate">{card.emoji ? `${card.emoji} ` : ''}{card.name}</span>
          <span className="block text-xs text-muted-foreground truncate">{meta}</span>
        </span>
        {card.is_member && <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Joined</span>}
      </Link>
    )
  }
  // navigate
  const href = `/explore?lat=${card.lat.toFixed(5)}&lng=${card.lng.toFixed(5)}&zoom=${card.zoom}`
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted pl-3 pr-3.5 h-8 hover:bg-cool-2 transition-colors text-sm"
    >
      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
      Map of <span className="font-medium">{card.label}</span>
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
  const going = meet.going.length
    ? `${meet.going.slice(0, 2).join(', ')}${meet.going.length > 2 ? ` +${meet.going.length - 2}` : ''} in`
    : 'Nobody in yet'
  // One line of state instead of a row of chips and a footnote.
  const stateLine = meet.open && status
    ? `Sent: ${WORD[status]}`
    : !meet.open && scheduled
      ? `Saved: ${WORD[scheduled]}, sends ${meet.opens_label}`
      : status
        ? `Sent: ${WORD[status]}`
        : meet.open ? 'Check-in open' : `Check-in opens ${meet.opens_label}`

  return (
    <div className="rounded-xl bg-muted p-1.5 pr-3 text-sm">
      <div className="flex items-center gap-2.5">
        {meet.thumb && <MapThumb small lat={meet.thumb.lat} lng={meet.thumb.lng} exact={meet.thumb.exact} label={meet.circle_name} />}
        <div className="min-w-0 flex-1 leading-snug">
          <Link href={`/circles/${encodeURIComponent(meet.circle_id)}`} className="block font-medium truncate hover:underline underline-offset-4">
            {meet.emoji ? `${meet.emoji} ` : ''}{meet.circle_name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {[`${meet.day_label} ${meet.time_label}`, meet.venue, going].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      <div role="group" aria-label={`Your answer for ${meet.circle_name}`} className="flex flex-wrap items-center gap-1 mt-1.5 pl-1">
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
                'h-7 px-3 rounded-full text-xs font-medium border transition-colors disabled:opacity-50',
                pressed
                  ? s === 'yes' ? 'bg-heat text-[#1a2230] border-heat' : 'bg-foreground text-background border-foreground'
                  : isSuggested ? 'bg-background border-dashed border-foreground' : 'bg-background border-transparent hover:border-cool-2',
              ].join(' ')}
            >
              {LABEL[s]}
            </button>
          )
        })}
        <span className={`ml-1 text-xs ${meet.open && !status ? 'text-pen font-medium' : 'text-muted-foreground'}`}>
          {(status || scheduled) && <Tick />} {stateLine}
          {showSuggestion ? `. Suggested ${WORD[suggested]}, not sent` : ''}
        </span>
        {state?.prev && (
          <button type="button" disabled={state.busy} onClick={() => onUndo(meet)} className="h-7 px-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Undo
          </button>
        )}
      </div>
      {state?.error && <p className="text-xs text-destructive mt-1 pl-1">{state.error}</p>}
    </div>
  )
}

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
