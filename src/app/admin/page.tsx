import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ReviewButtons from './ReviewButtons'
import ReportActions from './ReportActions'
import { reasonLabel } from '@/lib/reports'

type Report = {
  id: string
  target_type: 'user' | 'post' | 'comment' | 'circle'
  target_id: string
  circle_id: string | null
  reporter_id: string | null
  reported_user_id: string | null
  reason: string
  details: string | null
  snapshot: string | null
  status: string
  created_at: string
}

function targetHref(r: Report): string {
  if (r.target_type === 'user') return `/profile/${r.target_id}`
  if (r.target_type === 'circle') return `/circles/${r.target_id}`
  return r.circle_id ? `/circles/${r.circle_id}` : '#'
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // platform_admins is not client-readable; the helper is the only way in.
  const { data: isAdmin } = await supabase.rpc('is_platform_admin', { uid: user.id })
  if (!isAdmin) notFound()

  const { data: requests } = await supabase
    .from('business_requests')
    .select('id, business_name, contact_name, phone, email, message, status, created_at, user_id')
    .order('created_at', { ascending: false })

  // Readable only by platform admins (reports: platform admins read).
  const { data: reportRows } = await supabase
    .from('reports')
    .select('id, target_type, target_id, circle_id, reporter_id, reported_user_id, reason, details, snapshot, status, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  const reports = (reportRows ?? []) as Report[]
  const peopleIds = [...new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter((x): x is string => !!x))]
  const { data: people } = peopleIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', peopleIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const nameOf = (id: string | null) =>
    (id && people?.find((p) => p.id === id)?.full_name) || (id ? 'Someone' : 'a deleted account')

  const pending = (requests ?? []).filter((r) => r.status === 'pending')
  const settled = (requests ?? []).filter((r) => r.status !== 'pending')

  return (
    <>
      <TopNav />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-[720px] mx-auto px-4 sm:px-7 pt-8 pb-28 space-y-10">

          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-[2rem] sm:text-[2.6rem]">Reports</h1>
              <p className="text-lg text-muted-foreground">
                {reports.length === 0 ? 'Nothing open.' : `${reports.length} open, oldest first.`}
              </p>
              <p className="text-sm text-muted-foreground max-w-[60ch] pt-1">
                The text is what the reporter saw when they filed it, even if
                it has since been edited or deleted. Removing deletes the post or comment and
                closes every report on it.
              </p>
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing reported.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-3xl bg-muted p-5 space-y-2.5">
                    <p className="text-sm">
                      <span className="font-medium capitalize">{r.target_type}</span>
                      {', '}{reasonLabel(r.reason)}
                      <span className="text-muted-foreground">, {new Date(r.created_at).toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nameOf(r.reporter_id)} reported{' '}
                      {r.reported_user_id ? (
                        <a href={`/profile/${r.reported_user_id}`} className="underline underline-offset-2">
                          {nameOf(r.reported_user_id)}
                        </a>
                      ) : 'a deleted account'}
                      {'. '}
                      <a href={targetHref(r)} className="underline underline-offset-2">Open it</a>
                    </p>
                    {r.snapshot && (
                      <pre className="text-sm whitespace-pre-wrap break-words font-sans bg-background rounded-2xl p-3.5">{r.snapshot}</pre>
                    )}
                    {r.details && <p className="text-sm whitespace-pre-wrap">&ldquo;{r.details}&rdquo;</p>}
                    <ReportActions
                      reportId={r.id}
                      canRemove={r.target_type === 'post' || r.target_type === 'comment'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1 pt-6 border-t border-border">
            <h2 className="text-[1.6rem] font-light tracking-[-0.03em]">Business requests</h2>
            <p className="text-sm text-muted-foreground">
              Call or email them before approving. Approving flips their
              account to verified, which lets them mark their own circles
              commercial.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="label">{pending.length > 0 ? `Waiting, ${pending.length}` : 'Waiting'}</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((r) => (
                  <li key={r.id} className="rounded-3xl bg-muted p-5 space-y-2">
                    <p className="font-medium">{r.business_name}</p>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {r.contact_name && <p>Contact: {r.contact_name}</p>}
                      {r.phone && (
                        <p>
                          Phone:{' '}
                          <a href={`tel:${r.phone}`} className="underline underline-offset-2">
                            {r.phone}
                          </a>
                        </p>
                      )}
                      {r.email && (
                        <p>
                          Email:{' '}
                          <a href={`mailto:${r.email}`} className="underline underline-offset-2">
                            {r.email}
                          </a>
                        </p>
                      )}
                      {r.message && <p className="pt-1 whitespace-pre-wrap">{r.message}</p>}
                    </div>
                    <ReviewButtons requestId={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {settled.length > 0 && (
            <div className="space-y-3">
              <h3 className="label">Reviewed</h3>
              <ul className="space-y-2">
                {settled.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border py-3"
                  >
                    <span className="flex-1 text-sm">{r.business_name}</span>
                    <span className="text-sm text-muted-foreground capitalize">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
