import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import ReviewButtons from './ReviewButtons'

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

  const pending = (requests ?? []).filter((r) => r.status === 'pending')
  const settled = (requests ?? []).filter((r) => r.status !== 'pending')

  return (
    <>
      <TopNav />
      <main className="pt-14 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Business requests</h1>
            <p className="text-sm text-muted-foreground">
              Call or email them before approving. Approving flips their
              account to verified, which lets them mark their own circles
              commercial.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">
              Pending{pending.length > 0 ? ` · ${pending.length}` : ''}
            </p>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((r) => (
                  <li key={r.id} className="border rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold">{r.business_name}</p>
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
              <p className="text-sm font-semibold">Reviewed</p>
              <ul className="space-y-2">
                {settled.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border rounded-xl px-3 py-2.5"
                  >
                    <span className="flex-1 text-sm">{r.business_name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{r.status}</span>
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
