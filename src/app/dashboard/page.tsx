import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Circles</h1>
          <form action={logout}>
            <Button variant="outline" type="submit">Sign out</Button>
          </form>
        </div>
        <p className="text-muted-foreground">
          Welcome, {user.user_metadata?.full_name || user.email}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Your circles will appear here.
        </p>
      </div>
    </div>
  )
}
