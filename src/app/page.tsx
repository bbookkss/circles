import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import DemoWheel from '@/components/DemoWheel'
import AsciiField from '@/components/AsciiField'

const STEPS = [
  {
    n: '01',
    title: 'Find circles.',
    body: 'Every circle has a place on the map and a time it meets.',
  },
  {
    n: '02',
    title: 'Check in.',
    body: 'The day before, you say yes or no. Everyone sees who else is in.',
  },
  {
    n: '03',
    title: 'Become a regular.',
    body: 'Nobody makes a friend at a one-off. Then one week, someone saves you a seat.',
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
            <h1 className="text-4xl md:text-[2.75rem] font-medium leading-[1.05] text-balance">
              Find your people.<br />
              <em className="italic font-normal text-pen">Create your circle.</em>
            </h1>
            <p className="text-foreground/75 text-base md:text-lg mt-5 max-w-md">
              Groups that meet on a schedule, close enough to walk to. See who&apos;s coming before you go.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/signup">
                <Button size="lg" className="rounded-full">
                  Get started
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
              <p className="text-xs text-muted-foreground tabular-nums">{s.n}</p>
              <h3 className="text-xl mt-1">{s.title}</h3>
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
          <h2 className="text-3xl md:text-4xl font-medium">
            Start with one circle.
          </h2>
          <p className="text-muted-foreground text-sm mt-3">
            Join one that already meets near you, or start your own in about a minute.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <Link href="/signup"><Button size="lg" className="rounded-full">Get started</Button></Link>
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
