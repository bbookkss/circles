import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { joinCircle, leaveCircle } from '@/app/actions/circles'

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

  const { data: creator } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', circle.created_by)
    .maybeSingle()

  const [{ data: membership }, { count: memberCount }, { data: schedules }] = await Promise.all([
    supabase.from('circle_members').select('user_id').eq('circle_id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', id),
    supabase.from('circle_schedules').select('*').eq('circle_id', id),
  ])

  const isMember = !!membership
  const isOwner = circle.created_by === user.id

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground">
            ← Explore
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">
              {circle.emoji && <span className="mr-2">{circle.emoji}</span>}
              {circle.name}
            </h1>
            {circle.category && (
              <span className="inline-block mt-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {circle.category}
              </span>
            )}
          </div>

          {!isOwner && (
            <form action={isMember ? leaveCircle : joinCircle}>
              <input type="hidden" name="circle_id" value={id} />
              <Button variant={isMember ? 'outline' : 'default'} type="submit">
                {isMember ? 'Leave' : 'Join'}
              </Button>
            </form>
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

        {/* Events placeholder */}
        <div className="border rounded-lg p-6 text-center text-muted-foreground">
          <p className="font-medium mb-1">No events yet</p>
          <p className="text-sm">Events posted in this circle will appear here.</p>
        </div>
      </div>
    </div>
  )
}
