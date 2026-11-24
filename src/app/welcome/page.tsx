import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import HeatMap from '@/components/HeatMap'
import Logo from '@/components/Logo'

/**
 * Shown once, straight after signing up: the whole idea in three lines, on a
 * glass sheet over a strip of the map, then out to Explore. The three lines
 * aren't a sequence, so they carry no numbers.
 */

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const cards = [
    {
      title: 'What a circle is',
      body: 'A group that meets at the same place on a regular schedule. Volleyball every Thursday, morning pages at 7am, a run club that leaves from the same corner.',
    },
    {
      title: 'Finding one',
      body: 'Explore shows circles near you on a map. Filter by category, day or neighbourhood. Public ones you just join.',
    },
    {
      title: 'Starting one',
      body: 'Drop a pin and set a schedule. Public so anyone can find it, or private so you approve who joins.',
    },
  ]

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <nav className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-50 px-3 pt-2 pointer-events-none">
        <div className="glass pointer-events-auto mx-auto max-w-3xl h-12 rounded-full flex items-center pl-4 pr-1.5">
          <span className="flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight"><Logo />Circles</span>
        </div>
      </nav>

      <section aria-hidden className="h-[220px] sm:h-[300px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
        <HeatMap areas={[{ x: 0.24, y: 0.4, r: 100, temp: 0.7 }, { x: 0.7, y: 0.28, r: 80, temp: 0.5 }]} seed={21} />
      </section>

      <div className="relative z-[1] -mt-[120px] sm:-mt-[150px] px-4 pb-24">
        <div className="glass mx-auto max-w-[560px] rounded-[28px] p-6 sm:p-9 fade-rise">
          <h1 className="text-[1.75rem] sm:text-[2.2rem]">Welcome to Circles, {firstName}.</h1>
          <p className="text-lg text-muted-foreground mt-2">Here&apos;s the whole idea in three lines.</p>

          <ul className="mt-7 divide-y divide-border border-t border-border">
            {cards.map((card) => (
              <li key={card.title} className="py-4">
                <p className="font-medium">{card.title}</p>
                <p className="text-muted-foreground mt-1">{card.body}</p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2.5 mt-6">
            <Link href="/explore"><Button size="lg">Find circles near me</Button></Link>
            <Link href="/circles/new"><Button size="lg" variant="outline">Start one</Button></Link>
            <Link href="/home" className="ml-auto text-[15px] text-muted-foreground underline underline-offset-4 decoration-cool-2 hover:text-foreground">
              Skip for now
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
