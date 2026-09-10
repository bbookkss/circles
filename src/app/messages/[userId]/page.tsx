import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import BackButton from '@/components/BackButton'
import MessageThread from '@/components/MessageThread'

export default async function MessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (userId === user.id) redirect('/messages')

  const { data: other } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (!other) notFound()

  // Mutual-follow check (also enforced by RLS on insert)
  const [{ data: iFollow }, { data: followsMe }, { data: msgs }] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', userId).maybeSingle(),
    supabase.from('follows').select('follower_id').eq('follower_id', userId).eq('following_id', user.id).maybeSingle(),
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  const canMessage = !!iFollow && !!followsMe

  return (
    <>
      <TopNav />
      <div className="pt-14 h-screen flex flex-col bg-background">
        <header className="border-b px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <BackButton fallback="/messages" />
          <Link href={`/profile/${other.id}`} className="font-medium hover:underline underline-offset-2">
            {other.full_name}
          </Link>
        </header>
        <MessageThread
          meId={user.id}
          otherUserId={other.id}
          otherName={other.full_name ?? 'them'}
          initialMessages={(msgs ?? []).map((m) => ({ id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at }))}
          canMessage={canMessage}
        />
      </div>
    </>
  )
}
