import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import AsciiField from '@/components/AsciiField'

/**
 * Shown once, straight after signing up.
 *
 * Dark with the ripple field behind it, like the landing and auth pages. The
 * split is by moment rather than by route: everything outside the app proper
 * is dark and has the field, the app itself is bone and has none. Arriving
 * here from signup therefore looks like staying in the same place, and
 * leaving for /home looks like walking into the product.
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
      title: 'what a circle is',
      body: 'A group that meets at the same place on a regular schedule. Beach volleyball every Thursday. Morning pages at 7am. A run club that leaves from the same corner.',
    },
    {
      title: 'find one',
      body: 'Explore puts circles near you on a map. Filter by category, day, or neighborhood. Public ones you just join.',
    },
    {
      title: 'start one',
      body: 'Drop a pin, set a schedule, done. Public so anyone can find it, or private so you approve who gets in.',
    },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-foreground text-background flex flex-col items-center justify-center px-6 py-16">
      <AsciiField />

      <div className="relative max-w-lg w-full text-center space-y-10">

        <div className="space-y-3 fade-rise">
          <div className="w-12 h-12 rounded-full border-2 border-background mx-auto" />
          <h1 className="text-3xl font-bold lowercase">hey {firstName}, welcome to circles</h1>
        </div>

        <div className="grid gap-4 text-left">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className={`border border-background/20 rounded-xl p-5 space-y-1 bg-background/[0.06] backdrop-blur-[2px] fade-rise stagger-${i + 1}`}
            >
              <p className="font-semibold flex items-baseline gap-3 text-base lowercase">
                <span className="text-background/50 text-sm tabular-nums">0{i + 1}</span>
                {card.title}
              </p>
              <p className="text-sm text-background/70 pl-8">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center fade-rise stagger-4">
          <Link href="/explore">
            <Button size="lg" className="bg-background text-foreground hover:bg-background/90">
              Explore
            </Button>
          </Link>
          <Link href="/circles/new">
            {/* Not variant="outline": that sets bg-background, which on this
                dark panel is bone-on-bone and renders the label invisible. */}
            <Button
              size="lg"
              className="bg-transparent border border-background/30 text-background hover:bg-background/10"
            >
              Start one
            </Button>
          </Link>
        </div>

        <Link
          href="/home"
          className="text-xs text-background/60 underline underline-offset-4 hover:text-background block"
        >
          Skip for now
        </Link>
      </div>
    </main>
  )
}
