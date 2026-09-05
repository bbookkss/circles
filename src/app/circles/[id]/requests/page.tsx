import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { approveRequest, rejectRequest } from '@/app/actions/circles'
import TopNav from '@/components/TopNav'

export default async function RequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only admins can view this page
  const { data: membership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'admin') redirect(`/circles/${id}`)

  const { data: circle } = await supabase.from('circles').select('name, emoji').eq('id', id).single()
  if (!circle) notFound()

  const { data: requests } = await supabase
    .from('circle_join_requests')
    .select('user_id, status, created_at')
    .eq('circle_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Fetch profile names for each requester
  const userIds = requests?.map((r) => r.user_id) ?? []
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
    <TopNav />
    <div className="pt-14 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/circles/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← {circle.emoji} {circle.name}
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Join requests</h1>

        {!requests || requests.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <p className="font-medium mb-1">No pending requests</p>
            <p className="text-sm">New requests will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li key={req.user_id} className="border rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{profileMap[req.user_id] ?? 'Unknown user'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveRequest}>
                    <input type="hidden" name="circle_id" value={id} />
                    <input type="hidden" name="user_id" value={req.user_id} />
                    <Button size="sm" type="submit">Approve</Button>
                  </form>
                  <form action={rejectRequest}>
                    <input type="hidden" name="circle_id" value={id} />
                    <input type="hidden" name="user_id" value={req.user_id} />
                    <Button size="sm" variant="outline" type="submit">Reject</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </>
  )
}
