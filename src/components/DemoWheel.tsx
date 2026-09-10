
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

type Post = { who: string; body: string; reply?: { who: string; body: string } }
type Group = {
  emoji: string
  name: string
  where: string
  when: string
  going: number
  posts?: Post[]
}

/**
 * Grouped, not a flat list: each circle owns the posts beneath it, and they
 * are indented under it so the relationship is visible at a glance. Floating
 * them loose between circles made the feed look like two unrelated things.
 */
const GROUPS: Group[] = [
  {
    emoji: '🏐', name: 'Beach volleyball', where: 'Baker Beach', when: 'Tue & Thu · 5:30pm', going: 8,
    posts: [{ who: 'Maya', body: 'bringing an extra ball and the speaker' }],
  },
  { emoji: '☕', name: 'Morning pages', where: 'Valencia St', when: 'Weekdays · 7am', going: 5 },
  {
    emoji: '🏀', name: 'Panhandle pickup', where: 'The Panhandle', when: 'Wed · 6:30pm', going: 11,
    posts: [{ who: 'Devin', body: 'anyone around thursday? short a few', reply: { who: 'Rosa', body: "i'm in" } }],
  },
  { emoji: '🍜', name: 'Ramen club', where: 'Japantown', when: 'First Sunday · 1pm', going: 12 },
  {
    emoji: '🎸', name: 'Porch sessions', where: 'Bernal Heights', when: 'Sundays · 4pm', going: 6,
    posts: [{ who: 'Theo', body: 'same time next week, bring something to play' }],
  },
]

function CircleGroup({ g }: { g: Group }) {
  return (
    <div>
      <div className="rounded-xl border border-background/15 bg-background/[0.06] p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-sm flex items-center gap-2 min-w-0">
            <span aria-hidden>{g.emoji}</span>
            <span className="truncate">{g.name}</span>
          </p>
          <span className="text-[11px] text-background/50 whitespace-nowrap">{g.going} going</span>
        </div>
        <p className="text-[11px] text-background/50 mt-0.5">{g.where}</p>
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="rounded-full bg-background text-foreground text-[11px] font-medium px-2.5 py-1">Going</span>
          <span className="rounded-full border border-background/25 text-[11px] px-2.5 py-1 text-background/70">Maybe</span>
          <span className="ml-auto text-[11px] text-background/60 tabular-nums">{g.when}</span>
        </div>
      </div>

      {g.posts?.length ? (
        // Indented and hung off a rule, so a post reads as belonging to the
        // circle above it rather than sitting beside it.
        <div className="ml-5 mt-2 pl-3 border-l border-background/15 space-y-2">
          {g.posts.map((post, i) => (
            <div key={i} className="rounded-lg border border-background/10 bg-background/[0.03] px-3 py-2.5">
              <p className="text-sm">
                <span className="text-background/55 text-[11px] mr-1.5">{post.who}</span>
                {post.body}
              </p>
              {post.reply && (
                <p className="text-[13px] mt-1.5 text-background/65">
                  <span className="text-background/45 text-[11px] mr-1.5">{post.reply.who}</span>
                  {post.reply.body}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function DemoWheel({ className = 'h-[320px] md:h-[46vh]' }: { className?: string }) {
  const column = (
    <div className="space-y-4" aria-hidden>
      {GROUPS.map((g, i) => <CircleGroup key={i} g={g} />)}
    </div>
  )

  return (
    <div
      className={`relative overflow-hidden marquee-mask ${className}`}
      // Screen readers get the point without the carousel.
      role="img"
      aria-label="A feed of example circles: beach volleyball on Tuesdays and Thursdays, morning pages on weekdays, pickup basketball on Wednesdays, and posts between their members."
    >
      <div className="marquee-up space-y-4">
        {column}
        {column}
      </div>
    </div>
  )
}
