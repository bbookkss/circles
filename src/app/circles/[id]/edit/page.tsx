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
      <div className="pt-14 h-screen">
        <EditCircleClient circle={circle} schedule={schedules?.[0] ?? null} />
      </div>
    </>
  )
}
