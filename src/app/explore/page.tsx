import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExploreClient from './ExploreClient'

export default async function ExplorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch circles that have coordinates set
  const { data: circles } = await supabase
    .from('circles')
    .select('id, name, description, category, emoji, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  return <ExploreClient circles={circles ?? []} />
}
