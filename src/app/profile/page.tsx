import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditProfileForm from './EditProfileForm'
import BackfillButton from './BackfillButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id, role')
    .eq('user_id', user.id)

  const circleIds = memberships?.map((m) => m.circle_id) ?? []

  const { data: circles } = circleIds.length > 0
    ? await supabase
        .from('circles')
        .select('id, name, emoji, category')
        .in('id', circleIds)
    : { data: [] }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-8">Your profile</h1>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-lg">{profile?.full_name ?? 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <EditProfileForm fullName={profile?.full_name ?? ''} />

          <div className="mt-6 pt-6 border-t space-y-2">
            <p className="text-sm font-medium">Tools</p>
            <BackfillButton />
          </div>

          <div className="mt-10">
            <h2 className="font-semibold mb-4">Your circles ({circles?.length ?? 0})</h2>
            {circles && circles.length > 0 ? (
              <ul className="space-y-2">
                {circles.map((circle) => {
                  const role = memberships?.find((m) => m.circle_id === circle.id)?.role
                  return (
                    <li key={circle.id}>
                      <a
                        href={`/circles/${circle.id}`}
                        className="flex items-center gap-3 border rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                      >
                        <span className="text-lg">{circle.emoji ?? '●'}</span>
                        <span className="flex-1 text-sm font-medium">{circle.name}</span>
                        {role === 'admin' && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Admin</span>
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No circles yet.</p>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
