import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import EditCircleClient from './EditCircleClient'
import type { CirclePlace } from '@/lib/approxLocation'

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

  // The pin and venue come from circle_places(): they are withheld from the
  // table itself, and an admin is always a member.
  const [{ data: row }, { data: places, error: placesError }] = await Promise.all([
    supabase
      .from('circles')
      .select('id, name, description, category, emoji, neighborhood, city, visibility, is_free, price_note')
      .eq('id', id)
      .single(),
    supabase.rpc('circle_places', { cids: [id] }),
  ])
  if (!row) notFound()
  // Failing here beats loading an empty pin: saving the form would write it,
  // and the circle would lose its place.
  if (placesError) throw new Error('Could not load this circle\'s location. Try again.')
  const place = ((places ?? []) as CirclePlace[])[0]
  const circle = {
    ...row,
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    location: place?.location ?? null,
  }

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
      <div className="pt-16 md:h-screen">
        <EditCircleClient circle={circle} schedule={schedules?.[0] ?? null} />
      </div>
    </>
  )
}
