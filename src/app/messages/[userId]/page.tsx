import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import BackButton from '@/components/BackButton'
import MessageThread from '@/components/MessageThread'
import ReportButton from '@/components/ReportButton'
import BlockButton from '@/components/BlockButton'
import { unblockUser } from '@/app/actions/safety'

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
  const [{ data: iFollow }, { data: followsMe }, { data: msgs }, { data: blockRow }] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', userId).maybeSingle(),
    supabase.from('follows').select('follower_id').eq('follower_id', userId).eq('following_id', user.id).maybeSingle(),
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle(),
  ])
  const iBlocked = !!blockRow

  // Following is enough; see dm-follow-2026-09-13.sql for the policy and why.
  const canMessage = !!iFollow
  void followsMe

  return (
    <>
      <TopNav />
      <div className="pt-14 pb-16 md:pb-0 h-screen flex flex-col bg-background">
        <header className="border-b px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <BackButton fallback="/messages" />
          <Link href={`/profile/${other.id}`} className="font-medium hover:underline underline-offset-2">
            {other.full_name}
          </Link>
          {!iBlocked && (
            <div className="ml-auto flex items-center gap-4 text-xs">
              <ReportButton targetType="user" targetId={other.id} />
              <BlockButton userId={other.id} name={other.full_name ?? 'them'} />
            </div>
          )}
        </header>
        {iBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-foreground/75">
              You blocked {other.full_name ?? 'them'}. The conversation is hidden for both of you.
            </p>
            <form action={unblockUser}>
              <input type="hidden" name="user_id" value={other.id} />
              <button type="submit" className="text-sm rounded-full border border-foreground px-4 py-1.5 hover:bg-muted transition-colors">
                Unblock
              </button>
            </form>
          </div>
        ) : (
          <MessageThread
            meId={user.id}
            otherUserId={other.id}
            otherName={other.full_name ?? 'them'}
            initialMessages={(msgs ?? []).map((m) => ({ id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at }))}
            canMessage={canMessage}
          />
        )}
      </div>
    </>
  )
}
