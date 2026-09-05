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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <p className="text-4xl">👋</p>
          <h1 className="text-3xl font-bold">Hey {firstName}, welcome to Circles</h1>
          <p className="text-muted-foreground text-base">
            Here&apos;s what you need to know.
          </p>
        </div>

        {/* Explainer cards */}
        <div className="grid gap-4 text-left">
          <div className="border rounded-xl p-5 space-y-1">
            <p className="font-semibold flex items-center gap-2 text-base">
              <span>🔵</span> What is a circle?
            </p>
            <p className="text-sm text-muted-foreground">
              A circle is a recurring local group — people who meet at the same place, on a regular schedule, around something they love. Beach volleyball every Thursday, a jazz jam on Sunday mornings, a neighborhood run club.
            </p>
          </div>

          <div className="border rounded-xl p-5 space-y-1">
            <p className="font-semibold flex items-center gap-2 text-base">
              <span>🗺</span> Find circles near you
            </p>
            <p className="text-sm text-muted-foreground">
              Use the Explore page to browse an interactive map of circles in your city. Filter by category, day of the week, or neighborhood. Public circles are open to anyone — just hit Join.
            </p>
          </div>

          <div className="border rounded-xl p-5 space-y-1">
            <p className="font-semibold flex items-center gap-2 text-base">
              <span>✨</span> Start your own
            </p>
            <p className="text-sm text-muted-foreground">
              Got a regular thing going? Drop a pin, set a schedule, and create a circle. Make it public so anyone can find it, or private so you approve who gets in.
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/explore">
            <Button size="lg" className="w-full sm:w-auto">
              🗺 Explore circles near me
            </Button>
          </Link>
          <Link href="/circles/new">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              + Create a circle
            </Button>
          </Link>
        </div>

        <Link href="/home" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground block">
          Skip for now
        </Link>
      </div>
    </div>
  )
}
