import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import DemoWheel from '@/components/DemoWheel'
import AsciiField from '@/components/AsciiField'

/**
 * The argument, in three steps, ending where the headline started.
 *
 * This used to be Find / Check in / Become a regular, which described the
 * features in order. The thesis was in step 03 in small grey type and the
 * headline said "Find your people", which every meetup product says. Now the
 * page makes one claim and the steps carry it: the fourth time is the point,
 * and nothing else is built for the fourth time.
 */
const STEPS = [
  {
    n: '01',
    title: 'Find one near you.',
    body: 'Every circle has a spot on the map and a day it meets. Pick one close enough to walk to.',
  },
  {
    n: '02',
    title: 'Say if you are coming.',
    body: 'The day before, yes or no. You see who else is in before you decide, so you are never the only one who showed.',
  },
  {
    n: '03',
    title: 'Come back.',
    body: 'The second week someone knows your name. The fourth, they save you a seat.',
  },
]

export default async function Landing() {
  // Someone signed in does not need the pitch.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="min-h-screen bg-background">

      {/* ---------------------------------------------------------------
          Hero. Paper, like the app behind it; the demo column is ink cards on paper.
          --------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-background text-foreground">
        <AsciiField />

        <header className="relative mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <p className="font-display font-semibold text-[1.35rem] tracking-tight">circles</p>
          <Link
            href="/login"
            className="text-sm text-foreground/70 hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </header>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 md:pb-24 md:pt-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="fade-rise">
            {/* The claim, not the category. "Find your people" could sit on
                Meetup, Partiful, or a Facebook group; this could not. */}
            <h1 className="text-4xl md:text-[2.75rem] font-medium leading-[1.05] text-balance">
              Nobody makes a friend<br />at a one-off.<br />
              <em className="italic font-normal text-pen">Circles meet every week.</em>
            </h1>
            <p className="text-foreground/75 text-base md:text-lg mt-5 max-w-md">
              Same place, same time, the same people. Close enough to walk to, and you see who is coming before you go.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/signup">
                <Button size="lg" className="rounded-full">
                  Find a circle near me
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  className="rounded-full bg-transparent border border-pen text-pen hover:bg-pen hover:text-white"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          <div className="fade-rise stagger-1">
            <DemoWheel className="h-[380px] md:h-[520px]" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------
          How it works
          --------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="label">How it works</p>
        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((s) => (
            <li key={s.n}>
              <p className="num text-xs text-pen">{s.n}</p>
              <h3 className="text-xl mt-1">{s.title}</h3>
              <p className="text-sm text-foreground/75 mt-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------
          Close. Names the thing every other product gets wrong, which is
          also the reason this one exists.
          --------------------------------------------------------------- */}
      <section className="border-t border-foreground">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-medium text-balance">
            One-offs are easy to find.<br />
            <em className="italic font-normal text-pen">Somewhere to come back to is not.</em>
          </h2>
          <p className="text-foreground/75 text-sm mt-4 max-w-md mx-auto">
            Join a circle that already meets near you, or start one and pick the day.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <Link href="/signup"><Button size="lg" className="rounded-full">Find a circle near me</Button></Link>
            <Link href="/login"><Button size="lg" className="rounded-full bg-transparent border border-pen text-pen hover:bg-pen hover:text-white">Sign in</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-center justify-between text-xs text-muted-foreground">
          <p className="font-display font-semibold text-base">circles</p>
          <p>hicircles.com</p>
        </div>
      </footer>
    </main>
  )
}
