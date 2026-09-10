import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import DemoWheel from '@/components/DemoWheel'

const STEPS = [
  {
    n: '01',
    title: 'find one near you',
    body: 'Every circle has a real place on the map and a regular time. Not a feed of events across the city — things happening close enough to walk or bike to.',
  },
  {
    n: '02',
    title: 'say if you are coming',
    body: 'Check in the day before. Everyone sees who else is in, which is the difference between a plan and a group chat that goes quiet.',
  },
  {
    n: '03',
    title: 'show up. then again.',
    body: 'Nobody makes a friend at a one-off event. You make them by turning up to the same thing until the people there know your name.',
  },
]

export default async function Landing() {
  // Someone signed in does not need the pitch.
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (user) redirect('/home')

  return (
    <main className="min-h-screen bg-background">

      {/* ---------------------------------------------------------------
          Hero. Dark, so the demo column reads as a lit screen against it.
          --------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-foreground text-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/circle-draw.gif"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute -right-32 -bottom-40 w-[560px] max-w-none opacity-[0.07]"
        />

        <header className="relative mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <p className="font-bold text-lg tracking-tight lowercase">circles</p>
          <Link
            href="/login"
            className="text-sm text-background/70 hover:text-background transition-colors"
          >
            Sign in
          </Link>
        </header>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 md:pb-24 md:pt-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="fade-rise">
            <h1 className="text-4xl md:text-[2.5rem] font-bold leading-[1.1] lowercase text-balance">
              find your people.<br />
              <span className="text-background/55">create your circle.</span>
            </h1>
            <p className="text-background/70 text-base md:text-lg mt-5 max-w-md">
              Groups that meet on a schedule, close enough to walk to. See who&apos;s coming before you go.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/signup">
                <Button size="lg" className="bg-background text-foreground hover:bg-background/90">
                  Find circles near you
                </Button>
              </Link>
              <Link href="/login">
                {/* Not variant="outline": that sets bg-background, which on this
                    dark panel is bone-on-bone and renders the label invisible. */}
                <Button
                  size="lg"
                  className="bg-transparent border border-background/30 text-background hover:bg-background/10"
                >
                  I have an account
                </Button>
              </Link>
            </div>
            <p className="text-xs text-background/45 mt-4">Free. San Francisco to start.</p>
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
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((s) => (
            <li key={s.n}>
              <p className="text-xs text-muted-foreground tabular-nums">{s.n}</p>
              <h3 className="text-lg font-bold lowercase mt-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------
          Close
          --------------------------------------------------------------- */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold lowercase">
            there is probably one six blocks away.
          </h2>
          <p className="text-muted-foreground text-sm mt-3">
            And if there is not, starting one takes about a minute.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <Link href="/signup"><Button size="lg">Get started</Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex items-center justify-between text-xs text-muted-foreground">
          <p className="lowercase font-semibold">circles</p>
          <p>hicircles.com</p>
        </div>
      </footer>
    </main>
  )
}
