import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import NewCircleClient from './NewCircleClient'

export default async function NewCirclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <TopNav />
      <div className="pt-14 h-screen">
        <NewCircleClient />
      </div>
    </>
  )
}
