import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import BackButton from '@/components/BackButton'
import FollowButton from '@/components/FollowButton'

/**
 * /profile/:id/followers and /profile/:id/following
 *
 * One route for both because they differ by a single column. The counts on
 * the profile page were plain numbers that opened nothing, which pilot users
 * noticed within the hour; a count you cannot inspect reads as decoration.
 *
 * Works for your own id too, so the profile page can link to
 * /profile/<me>/followers without a special case.
 */

const LISTS = {
  followers: { title: 'Followers', column: 'following_id', pick: 'follower_id' },
  following: { title: 'Following', column: 'follower_id', pick: 'following_id' },
} as const

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function FollowListPage({
  params,
}: {
  params: Promise<{ id: string; list: string }>
}) {
  const { id, list } = await params
  if (list !== 'followers' && list !== 'following') notFound()
  const spec = LISTS[list]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subject } = await supabase
    .from('profiles').select('id, full_name').eq('id', id).maybeSingle()
  if (!subject) notFound()

  const { data: rows } = await supabase
    .from('follows')
    .select(spec.pick)
    .eq(spec.column, id)

  const ids = (rows ?? []).map((r) => (r as Record<string, string>)[spec.pick])

  const [{ data: people }, { data: myFollows }] = await Promise.all([
    ids.length > 0
      ? supabase.from('profiles').select('id, full_name, instagram').in('id', ids).order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; instagram: string | null }[] }),
    ids.length > 0
      ? supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', ids)
      : Promise.resolve({ data: [] as { following_id: string }[] }),
  ])
  const iFollow = new Set((myFollows ?? []).map((f) => f.following_id))

  const isMe = subject.id === user.id
  const backTo = isMe ? '/profile' : `/profile/${subject.id}`

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-3">
            <BackButton fallback={backTo} />
            <div>
              <h1 className="text-xl font-bold">{spec.title}</h1>
              <p className="text-sm text-muted-foreground">
                {isMe ? 'You' : subject.full_name} · {ids.length}
              </p>
            </div>
          </div>

          {!people || people.length === 0 ? (
            <div className="border-t border-b py-10 text-center text-sm text-muted-foreground">
              {list === 'followers'
                ? (isMe ? 'Nobody follows you yet.' : 'No followers yet.')
                : (isMe ? 'You are not following anyone yet.' : 'Not following anyone yet.')}
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-b">
              {people.map((p) => {
                const name = p.full_name ?? 'Someone'
                const mine = p.id === user.id
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initialsOf(name)}
                    </div>
                    <Link href={mine ? '/profile' : `/profile/${p.id}`} className="flex-1 min-w-0 hover:underline underline-offset-2">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {p.instagram && <p className="text-xs text-muted-foreground truncate">@{p.instagram}</p>}
                    </Link>
                    {!mine && <FollowButton targetId={p.id} initialIsFollowing={iFollow.has(p.id)} />}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  )
}
