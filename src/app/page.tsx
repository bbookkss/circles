import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import PublicSearch from '@/components/PublicSearch'
import HeatMap, { type HeatArea } from '@/components/HeatMap'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * The argument in three steps, ending where the headline started. The steps
 * are a real sequence (find, say, come back), which is why they keep quiet
 * numbers.
 *
 * The hero map is drawn, not real: signed-out visitors only ever see areas,
 * never pins, the same rule the database enforces on Explore.
 */
const STEPS = [
  {
    title: 'Find one near you.',
    body: 'Every circle has an area on the map and a day it meets. Pick one close enough to walk to.',
  },
  {
    title: "Say if you're coming.",
    body: "The day before, yes or no. You see who else is in before you decide, so you're never the only one who showed.",
  },
  {
    title: 'Show up.',
    body: "That's it. Come back whenever it suits you; the circle meets every week either way.",
  },
]

const HERO_AREAS: HeatArea[] = [
  { x: 0.12, y: 0.3, r: 110, temp: 0.7 },
  { x: 0.44, y: 0.16, r: 80, temp: 0.45 },
  { x: 0.7, y: 0.34, r: 120, temp: 1 },
  { x: 0.9, y: 0.14, r: 70, temp: 0.4 },
  { x: 0.3, y: 0.72, r: 90, temp: 0.55 },
  { x: 0.86, y: 0.78, r: 84, temp: 0.6 },
]

const PEEK = [
  { when: 'Tomorrow, 7:00 pm', name: 'Thursday chess', faces: ['MO', 'SL', 'AK'], who: 'Maya, Sam and 4 more are in', open: true },
  { when: 'Saturday, 8:30 am', name: 'Saturday morning run', faces: ['PR', 'JP'], who: 'Priya, Jon and 2 more are in', open: false },
]

export default async function Landing() {
  // Someone signed in does not need the pitch.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="min-h-screen bg-background">
      {/* Signed-out nav: a glass pill over the map. */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-3 pt-2 pointer-events-none">
        <div className="glass pointer-events-auto mx-auto max-w-3xl h-12 rounded-full flex items-center gap-1 pl-4 pr-1.5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight">
            <Logo />
            Circles
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/login" className="px-3.5 py-2 rounded-full text-[0.95rem] hover:bg-muted transition-colors">Log in</Link>
            <Link href="/signup"><Button size="sm">Sign up</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero: the map is the picture, the search sits on glass over it. */}
      <section className="relative overflow-hidden min-h-[620px]">
        <div className="absolute inset-0">
          <HeatMap areas={HERO_AREAS} seed={5} />
        </div>
        <div className="relative mx-auto max-w-[1080px] px-4 pt-[120px] md:pt-[150px] pb-14 grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 items-end">
          <div className="glass rounded-[28px] p-6 md:p-9 fade-rise">
            {/* The claim, not the category. */}
            <h1 className="text-[2.3rem] md:text-[3.6rem]">
              Nobody makes a friend at a one-off. Circles meet every week.
            </h1>
            <p className="text-lg text-muted-foreground mt-4 max-w-[52ch]">
              Same place, same time, the same people. Close enough to walk to, and you see who&apos;s coming before you go.
            </p>
            <PublicSearch />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 md:justify-self-end md:w-[340px] fade-rise stagger-2" aria-label="Example circles">
            {PEEK.map((c, i) => (
              <div key={c.name} className={`glass rounded-[22px] px-5 py-4 ${i > 0 ? 'hidden sm:block' : ''}`}>
                <p className="text-sm text-muted-foreground">{c.when}</p>
                <p className="text-lg font-medium tracking-tight mt-0.5">{c.name}</p>
                <p className="text-sm text-muted-foreground mt-2.5 flex items-center gap-2.5">
                  <span className="flex" aria-hidden>
                    {c.faces.map((f, k) => (
                      <span key={f} className={`w-[26px] h-[26px] rounded-full grid place-items-center text-[11px] font-medium bg-cool-2 border-2 border-background ${k ? '-ml-1.5' : ''}`}>{f}</span>
                    ))}
                  </span>
                  {c.who}
                </p>
                {c.open && (
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-pen mt-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-heat" />Check-in open
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works. A real sequence, so it keeps quiet numbers. */}
      <section className="mx-auto max-w-[1080px] px-4 pt-20 md:pt-24 pb-16 md:pb-20">
        <h2 className="text-[1.75rem] md:text-[2.2rem] font-light tracking-[-0.03em] max-w-[20ch]">Getting started takes a minute.</h2>
        <ol className="mt-11 grid gap-7 md:grid-cols-3 md:gap-10">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-foreground pt-4">
              <p className="text-[15px] text-muted-foreground mb-4">{i + 1}</p>
              <h3 className="text-[22px] font-normal">{s.title}</h3>
              <p className="text-muted-foreground mt-2 max-w-[34ch]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy, shown rather than claimed: the same circle as Explore draws
          it before you join (a glow over its area, no pin) and after (the
          pin and the venue). That is exactly what CirclesMap does with
          `approximate` circles, so the page promises nothing the map doesn't. */}
      <section className="mx-auto max-w-[1080px] px-4 pb-24">
        <div className="rounded-3xl bg-muted p-6 md:p-10">
          <h2 className="text-[22px]">See roughly where before you join.</h2>
          <p className="text-muted-foreground mt-3 max-w-[56ch]">
            On the map, a circle you haven&apos;t joined shows as a soft glow over its neighbourhood, not a pin. Join, and you see the exact spot and the venue. It keeps the places people meet every week off the open internet.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Before you join', sub: 'Thursday chess, around Mission Dolores', glow: true },
              { title: 'Once you\'re in', sub: 'Ritual Coffee, Valencia St', glow: false },
            ].map((v) => (
              <figure key={v.title} className="m-0">
                <div className="relative h-[200px] rounded-[18px] overflow-hidden">
                  <HeatMap
                    seed={29}
                    areas={v.glow ? [{ x: 0.5, y: 0.5, r: 80, temp: 0.9 }] : []}
                    label={v.glow ? 'A glow over the area where a circle meets, with no pin' : 'A pin on the exact spot where a circle meets'}
                  />
                  {!v.glow && (
                    // The member's view: a real pin on the spot, like Explore's.
                    <svg
                      aria-hidden
                      width="30"
                      height="38"
                      viewBox="0 0 30 38"
                      className="absolute left-[53%] top-[47%] -translate-x-1/2 -translate-y-full drop-shadow-md"
                    >
                      <path d="M15 37s12-12.2 12-22A12 12 0 0 0 3 15c0 9.8 12 22 12 22z" className="fill-foreground stroke-background" strokeWidth="2" />
                      <circle cx="15" cy="15" r="4.5" className="fill-background" />
                    </svg>
                  )}
                </div>
                <figcaption className="mt-3">
                  <span className="block text-[15px] font-medium">{v.title}</span>
                  <span className="block text-sm text-muted-foreground">{v.sub}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Close. */}
      <section className="mx-auto max-w-[1080px] px-4 pt-6 pb-28">
        <h2 className="text-[1.9rem] md:text-[3rem] font-light tracking-[-0.03em] max-w-[18ch]">
          One-offs are easy to find. Somewhere to come back to isn&apos;t.
        </h2>
        <p className="text-lg text-muted-foreground mt-3">Join a circle that already meets near you, or start one and pick the day.</p>
        <div className="flex flex-wrap gap-2.5 mt-6">
          <Link href="/signup"><Button size="lg">Find a circle near me</Button></Link>
          <Link href="/signup"><Button size="lg" variant="outline">Start a circle</Button></Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1080px] px-4 py-7 flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2 font-semibold text-foreground"><Logo size={16} />Circles</span>
          <span>hicircles.com</span>
        </div>
      </footer>
    </main>
  )
}
