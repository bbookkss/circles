
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
  when: string
  going: number
  /** The first few checked in, as the circle page itself lists them. */
  goingNames: string[]
  posts?: Post[]
}

/**
 * Grouped, not a flat list: each circle owns the posts beneath it, and they
 * are indented under it so the relationship is visible at a glance. Floating
 * them loose between circles made the feed look like two unrelated things.
 */
const GROUPS: Group[] = [
  {
    emoji: '🏐', name: 'Beach volleyball', when: 'Tue & Thu · 5:30pm',
    going: 8, goingNames: ['Olivia', 'Jack', 'Priya'],
    posts: [{ who: 'Maya', body: 'bringing an extra ball and the speaker' }],
  },
  {
    emoji: '☕', name: 'Morning pages', when: 'Weekdays · 7am',
    going: 5, goingNames: ['Rachel', 'Eli', 'Nadia'],
  },
  {
    emoji: '🏀', name: 'Pickup basketball', when: 'Wed · 6:30pm',
    going: 11, goingNames: ['Brandon', 'Simone', 'Thomas'],
    posts: [{ who: 'Devin', body: 'anyone around thursday? short a few', reply: { who: 'Rosa', body: "i'm in" } }],
  },
  {
    emoji: '🍜', name: 'Ramen club', when: 'First Sunday · 1pm',
    going: 12, goingNames: ['Bella', 'Benjamin', 'Jasper'],
  },
  {
    emoji: '🎸', name: 'Porch sessions', when: 'Sundays · 4pm',
    going: 6, goingNames: ['Theo', 'Maya', 'Olivia'],
    posts: [{ who: 'Theo', body: 'same time next week, bring something to play' }],
  },
]

function CircleGroup({ g }: { g: Group }) {
  return (
    <div>
      <div className="border border-foreground bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-sm flex items-center gap-2 min-w-0">
            <span aria-hidden>{g.emoji}</span>
            <span className="truncate">{g.name}</span>
          </p>
          <span className="label whitespace-nowrap">{g.going} going</span>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="rounded-full bg-pen text-white text-[11px] font-medium px-2.5 py-1">Going</span>
          <span className="rounded-full border border-foreground text-[11px] px-2.5 py-1 text-foreground">Maybe</span>
          <span className="ml-auto num text-[11px] text-foreground/75">{g.when}</span>
        </div>
        <p className="text-[11px] text-foreground/70 mt-2.5 pt-2.5 border-t border-border truncate">
          {g.goingNames.join(', ')}
          {g.going > g.goingNames.length ? ` +${g.going - g.goingNames.length}` : ''}
        </p>
      </div>

      {g.posts?.length ? (
        // Indented and hung off a rule, so a post reads as belonging to the
        // circle above it rather than sitting beside it.
        <div className="ml-5 mt-2 pl-3 border-l border-border space-y-2">
          {g.posts.map((post, i) => (
            <div key={i} className="border border-border bg-card px-3 py-2.5 space-y-1.5">
              {/* Name and message at the same size: the speaker is the subject
                  of the line, not a footnote to it. */}
              <p className="text-sm leading-snug">
                <span className="font-semibold text-foreground">{post.who}:</span>{' '}
                <span className="text-foreground/80">{post.body}</span>
              </p>
              {post.reply && (
                <p className="text-sm leading-snug pl-2.5 border-l border-border">
                  <span className="font-semibold text-foreground/85">{post.reply.who}:</span>{' '}
                  <span className="text-foreground/70">{post.reply.body}</span>
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
