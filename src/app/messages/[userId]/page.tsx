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
      <div data-chat-thread className="pt-14 max-md:pb-[var(--tabbar)] h-[calc(100dvh-env(safe-area-inset-top))] flex flex-col bg-background">
        <header className="max-w-2xl w-full mx-auto px-3 md:px-6 pt-4 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-border">
          <BackButton fallback="/messages" />
          <Link href={`/profile/${other.id}`} className="min-w-0 truncate text-lg font-medium tracking-tight px-1 hover:underline underline-offset-4 decoration-1">
            {other.full_name}
          </Link>
          {!iBlocked && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <ReportButton targetType="user" targetId={other.id} label="Report" className="pill-btn" />
              <BlockButton userId={other.id} name={other.full_name ?? 'them'} label="Block" className="pill-btn hover:!bg-destructive hover:!text-white" />
            </div>
          )}
        </header>
        {iBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-muted-foreground max-w-sm">
              You blocked {other.full_name ?? 'them'}. The conversation is hidden for both of you.
            </p>
            <form action={unblockUser}>
              <input type="hidden" name="user_id" value={other.id} />
              <button type="submit" className="text-sm font-medium rounded-full bg-foreground text-background px-5 py-2.5 hover:opacity-85 transition-opacity">
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
