import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Circles the user is a member of
  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id, role')
    .eq('user_id', user.id)

  const circleIds = memberships?.map((m) => m.circle_id) ?? []

  const { data: circles } = circleIds.length > 0
    ? await supabase
        .from('circles')
        .select('id, name, emoji, category, location, visibility')
        .in('id', circleIds)
    : { data: [] }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-1">Hey, {firstName} 👋</h1>
          <p className="text-muted-foreground mb-8">Here are your circles.</p>

          {circles && circles.length > 0 ? (
            <ul className="space-y-3 mb-8">
              {circles.map((circle) => {
                const membership = memberships?.find((m) => m.circle_id === circle.id)
                return (
                  <li key={circle.id}>
                    <Link
                      href={`/circles/${circle.id}`}
                      className="flex items-center gap-4 border rounded-lg px-4 py-3 hover:bg-muted transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl flex-shrink-0">
                        {circle.emoji ?? '●'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{circle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[circle.category, circle.location].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {membership?.role === 'admin' && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Admin</span>
                        )}
                        {circle.visibility === 'private' && (
                          <span className="text-xs text-muted-foreground">🔒</span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="border rounded-lg p-8 text-center text-muted-foreground mb-8">
              <p className="font-medium mb-1">You haven&apos;t joined any circles yet</p>
              <p className="text-sm mb-4">Find one on the map or create your own.</p>
              <div className="flex gap-2 justify-center">
                <Link href="/explore"><Button variant="outline">Explore</Button></Link>
                <Link href="/circles/new"><Button>Create a circle</Button></Link>
              </div>
            </div>
          )}

          {circles && circles.length > 0 && (
            <div className="flex gap-2">
              <Link href="/explore"><Button variant="outline">Explore more</Button></Link>
              <Link href="/circles/new"><Button>+ New circle</Button></Link>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
