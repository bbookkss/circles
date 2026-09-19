import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditCircleClient from './EditCircleClient'

export default async function EditCirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('circle_members')
    .select('role')
    .eq('circle_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.role !== 'admin') redirect(`/circles/${id}`)

  const { data: circle } = await supabase.from('circles').select('*').eq('id', id).single()
  if (!circle) notFound()

  const { data: schedules } = await supabase
    .from('circle_schedules')
    .select('*')
    .eq('circle_id', id)

  return (
    <>
      <TopNav />
      {/* h-screen only from md up. On a phone this is an ordinary
          scrolling page: 100vh there is the height with the browser chrome
          hidden, so a 100vh box is taller than what you can see, the page
          scrolls by the difference, and the form's own scroller ends up
          nested inside a container that is already the wrong height. That
          combination is what produced the dead space below Create Circle. */}
      <div className="pt-14 md:h-screen">
        <EditCircleClient circle={circle} schedule={schedules?.[0] ?? null} />
      </div>
    </>
  )
}
