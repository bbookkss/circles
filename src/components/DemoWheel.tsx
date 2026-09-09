
/**
 * A looping column of sample circles, posts and check-ins for the signed-out
 * hero — the product demonstrating itself instead of a list of bullet points
 * describing it.
 *
 * The content is illustrative, the same way a product screenshot is: invented
 * circles in real neighbourhoods, showing what the app looks like in use.
 * Deliberately no testimonials and no praise of the product in anyone's mouth
 * — made-up features are a demo, made-up endorsements are a lie.
 *
 * Motion is one CSS animation on a doubled track, so there is no JS, no timer
 * and nothing to hydrate. It pauses on hover and is switched off entirely
 * under prefers-reduced-motion.
 */

type Meet = { kind: 'meet'; emoji: string; name: string; where: string; when: string; going: number }
type Post = { kind: 'post'; who: string; circle: string; body: string; reply?: { who: string; body: string } }
type Card = Meet | Post

const CARDS: Card[] = [
  { kind: 'meet', emoji: '🏐', name: 'Beach volleyball', where: 'Baker Beach', when: 'Tue & Thu · 5:30pm', going: 8 },
  { kind: 'post', who: 'Maya', circle: 'Beach volleyball', body: 'bringing an extra ball and the speaker' },
  { kind: 'meet', emoji: '☕', name: 'Morning pages', where: 'Valencia St', when: 'Weekdays · 7am', going: 5 },
  {
    kind: 'post', who: 'Devin', circle: 'Panhandle pickup', body: 'anyone around thursday? short a few',
    reply: { who: 'Rosa', body: "i'm in" },
  },
  { kind: 'meet', emoji: '🏀', name: 'Panhandle pickup', where: 'The Panhandle', when: 'Wed · 6:30pm', going: 11 },
  { kind: 'meet', emoji: '🍜', name: 'Ramen club', where: 'Japantown', when: 'First Sunday · 1pm', going: 12 },
  { kind: 'post', who: 'Theo', circle: 'Porch sessions', body: 'same time next week, bring something to play' },
  { kind: 'meet', emoji: '🎸', name: 'Porch sessions', where: 'Bernal Heights', when: 'Sundays · 4pm', going: 6 },
]

function MeetCard({ c }: { c: Meet }) {
  return (
    <div className="rounded-xl border border-background/15 bg-background/[0.06] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-sm flex items-center gap-2 min-w-0">
          <span aria-hidden>{c.emoji}</span>
          <span className="truncate">{c.name}</span>
        </p>
        <span className="text-[11px] text-background/50 whitespace-nowrap">{c.going} going</span>
      </div>
      <p className="text-[11px] text-background/50 mt-0.5">{c.where}</p>
      <div className="flex items-center gap-1.5 mt-2.5">
        <span className="rounded-full bg-background text-foreground text-[11px] font-medium px-2.5 py-1">Going</span>
        <span className="rounded-full border border-background/25 text-[11px] px-2.5 py-1 text-background/70">Maybe</span>
        <span className="ml-auto text-[11px] text-background/60 tabular-nums">{c.when}</span>
      </div>
    </div>
  )
}

function PostCard({ c }: { c: Post }) {
  return (
    <div className="rounded-xl border border-background/10 bg-background/[0.03] p-3.5">
      <p className="text-[11px] text-background/50">
        <span className="text-background/80 font-medium">{c.who}</span> in {c.circle}
      </p>
      <p className="text-sm mt-1">{c.body}</p>
      {c.reply && (
        <p className="text-[13px] mt-2 pl-3 border-l border-background/15 text-background/70">
          <span className="text-background/85">{c.reply.who}</span> {c.reply.body}
        </p>
      )}
    </div>
  )
}

export default function DemoWheel({ className = 'h-[320px] md:h-[46vh]' }: { className?: string }) {
  const column = (
    <div className="space-y-3" aria-hidden>
      {CARDS.map((c, i) =>
        c.kind === 'meet' ? <MeetCard key={i} c={c} /> : <PostCard key={i} c={c} />
      )}
    </div>
  )

  return (
    <div
      className={`relative overflow-hidden marquee-mask ${className}`}
      // Screen readers get the point without the carousel.
      role="img"
      aria-label="A feed of example circles: beach volleyball on Tuesdays and Thursdays, morning pages on weekdays, pickup basketball on Wednesdays, and posts between their members."
    >
      <div className="marquee-up space-y-3">
        {column}
        {column}
      </div>
    </div>
  )
}
