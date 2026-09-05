import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { joinCircle, leaveCircle, requestToJoin, withdrawRequest } from '@/app/actions/circles'
import TopNav from '@/components/TopNav'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every other week',
  monthly: 'Monthly',
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

export default async function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: circle } = await supabase
    .from('circles')
    .select('*')
    .eq('id', id)
    .single()

  if (!circle) notFound()

  const [
    { data: creator },
    { data: membership },
    { count: memberCount },
    { data: schedules },
    { data: joinRequest },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', circle.created_by).maybeSingle(),
    supabase.from('circle_members').select('role').eq('circle_id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', id),
    supabase.from('circle_schedules').select('*').eq('circle_id', id),
    supabase.from('circle_join_requests').select('status').eq('circle_id', id).eq('user_id', user.id).maybeSingle(),
  ])

  const isMember = !!membership
  const isAdmin = membership?.role === 'admin'
  const isOwner = circle.created_by === user.id
  const isPrivate = circle.visibility === 'private'
  const hasPendingRequest = joinRequest?.status === 'pending'

  return (
    <>
    <TopNav />
    <div className="pt-14 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="mb-6 flex items-center justify-between">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground">
            ← Explore
          </Link>
          {isAdmin && (
            <div className="flex items-center gap-4">
              <Link href={`/circles/${id}/edit`} className="text-sm text-muted-foreground hover:text-foreground">
                Edit
              </Link>
              <Link href={`/circles/${id}/requests`} className="text-sm text-muted-foreground hover:text-foreground">
                Requests
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isPrivate && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">🔒 Private</span>
              )}
              {circle.category && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{circle.category}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold">
              {circle.emoji && <span className="mr-2">{circle.emoji}</span>}
              {circle.name}
            </h1>
          </div>

          {/* Action button — depends on state */}
          {!isOwner && (
            isMember ? (
              <form action={leaveCircle}>
                <input type="hidden" name="circle_id" value={id} />
                <Button variant="outline" type="submit">Leave</Button>
              </form>
            ) : isPrivate ? (
              hasPendingRequest ? (
                <form action={withdrawRequest}>
                  <input type="hidden" name="circle_id" value={id} />
                  <Button variant="outline" type="submit">Withdraw request</Button>
                </form>
              ) : (
                <form action={requestToJoin}>
                  <input type="hidden" name="circle_id" value={id} />
                  <Button type="submit">Request to join</Button>
                </form>
              )
            ) : (
              <form action={joinCircle}>
                <input type="hidden" name="circle_id" value={id} />
                <Button type="submit">Join</Button>
              </form>
            )
          )}
        </div>

        {circle.description && (
          <p className="text-muted-foreground mb-4">{circle.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
          {circle.location && <span>📍 {circle.location}</span>}
          <span>👥 {memberCount ?? 0} members</span>
          {creator?.full_name && <span>Created by {creator.full_name}</span>}
        </div>

        {/* Schedule */}
        {schedules && schedules.length > 0 && (
          <div className="border rounded-lg p-4 mb-6 space-y-2">
            <p className="text-sm font-medium">Schedule</p>
            {schedules.map((s) => (
              <div key={s.id} className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  {(s.days_of_week as number[]).sort().map((d) => DAY_NAMES[d]).join(', ')}
                </span>
                {' · '}
                {formatTime(s.start_time)} – {formatTime(s.end_time)}
                {' · '}
                {FREQ_LABELS[s.frequency] ?? s.frequency}
                {s.note && <span className="block text-xs mt-0.5 italic">{s.note}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Gated content for private circles */}
        {isPrivate && !isMember ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">🔒</p>
            <p className="font-medium mb-1">This circle is private</p>
            <p className="text-sm">
              {hasPendingRequest
                ? 'Your request is pending. The admin will review it soon.'
                : 'Request to join to see posts and events.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg p-6 text-center text-muted-foreground">
            <p className="font-medium mb-1">No events yet</p>
            <p className="text-sm">Events posted in this circle will appear here.</p>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
