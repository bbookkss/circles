import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

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
      title: 'What is a circle?',
      body: 'A circle is a recurring local group. People who meet at the same place, on a regular schedule, around something they love. Beach volleyball every Thursday, a jazz jam on Sunday mornings, a neighborhood run club.',
    },
    {
      title: 'Find circles near you',
      body: 'Use the Explore page to browse an interactive map of circles in your city. Filter by category, day of the week, or neighborhood. Public circles are open to anyone. Just hit Join.',
    },
    {
      title: 'Start your own',
      body: 'Got a regular thing going? Drop a pin, set a schedule, and create a circle. Make it public so anyone can find it, or private so you approve who gets in.',
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center space-y-10">

        {/* Header */}
        <div className="space-y-3 fade-rise">
          <div className="w-12 h-12 rounded-full border-2 border-foreground mx-auto" />
          <h1 className="text-3xl font-bold lowercase">hey {firstName}, welcome to circles</h1>
          <p className="text-muted-foreground text-base">
            Here&apos;s what you need to know.
          </p>
        </div>

        {/* Explainer cards */}
        <div className="grid gap-4 text-left">
          {cards.map((card, i) => (
            <div key={card.title} className={`border rounded-xl p-5 space-y-1 bg-card fade-rise stagger-${i + 1}`}>
              <p className="font-semibold flex items-baseline gap-3 text-base">
                <span className="text-muted-foreground text-sm tabular-nums">0{i + 1}</span>
                {card.title}
              </p>
              <p className="text-sm text-muted-foreground pl-8">{card.body}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center fade-rise stagger-4">
          <Link href="/explore">
            <Button size="lg" className="w-full sm:w-auto">Explore circles near me</Button>
          </Link>
          <Link href="/circles/new">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">Create a circle</Button>
          </Link>
        </div>

        <Link href="/home" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground block">
          Skip for now
        </Link>
      </div>
    </div>
  )
}
