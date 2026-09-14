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
      title: 'What a circle is',
      body: 'A group that meets at the same place on a regular schedule. Beach volleyball every Thursday. Morning pages at 7am. A run club that leaves from the same corner.',
    },
    {
      title: 'Find one',
      body: 'Explore puts circles near you on a map. Filter by category, day, or neighborhood. Public ones you just join.',
    },
    {
      title: 'Start one',
      body: 'Drop a pin, set a schedule, done. Public so anyone can find it, or private so you approve who gets in.',
    },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col items-center justify-center px-6 py-16">
      <AsciiField />

      <div className="relative max-w-lg w-full text-center space-y-10">

        <div className="space-y-3 fade-rise">
          <div className="w-12 h-12 rounded-full border-2 border-pen mx-auto" />
          <h1 className="text-3xl md:text-4xl font-medium">Hey {firstName}, <em className="italic font-normal text-pen">welcome to circles.</em></h1>
        </div>

        <div className="grid gap-4 text-left">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className={`border border-foreground p-5 space-y-1 bg-card fade-rise stagger-${i + 1}`}
            >
              <p className="font-display font-semibold flex items-baseline gap-3 text-lg">
                <span className="num text-pen text-xs">0{i + 1}</span>
                {card.title}
              </p>
              <p className="text-sm text-foreground/75 pl-8">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center fade-rise stagger-4">
          <Link href="/explore">
            <Button size="lg" className="rounded-full">
              Explore
            </Button>
          </Link>
          <Link href="/circles/new">
            <Button
              size="lg"
              className="rounded-full bg-transparent border border-pen text-pen hover:bg-pen hover:text-white"
            >
              Start one
            </Button>
          </Link>
        </div>

        <Link
          href="/home"
          className="label normal-case tracking-normal underline underline-offset-4 hover:text-foreground block"
        >
          Skip for now
        </Link>
      </div>
    </main>
  )
}
