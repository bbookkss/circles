import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/TopNav'
import { Button } from '@/components/ui/button'
import BusinessRequestForm from './BusinessRequestForm'

export default async function BusinessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from('profiles').select('is_business').eq('id', user.id).maybeSingle(),
    supabase
      .from('business_requests')
      .select('status, business_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const isBusiness = profile?.is_business === true

  return (
    <>
      <TopNav />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-[640px] mx-auto px-4 sm:px-7 pt-8 pb-28 space-y-7">

          <div className="space-y-2">
            <h1 className="text-[2rem] sm:text-[2.6rem]">For restaurants and businesses</h1>
            <p className="text-lg text-muted-foreground max-w-[52ch]">
              Run a circle for your venue. Taco Tuesdays, live music, trivia
              nights. It shows up on the map alongside everything else
              happening nearby.
            </p>
          </div>

          {isBusiness ? (
            <div className="rounded-3xl bg-muted p-6 space-y-3">
              <p className="font-medium">Your account is verified</p>
              <p className="text-sm text-muted-foreground">
                When you create a circle you can mark it as commercial. It will
                appear in a different colour on the map, and people can filter
                for it.
              </p>
              <Link href="/circles/new">
                <Button>Start a circle</Button>
              </Link>
            </div>
          ) : existing?.status === 'pending' ? (
            <div className="rounded-3xl bg-muted p-6 space-y-1.5">
              <p className="font-medium">Request pending</p>
              <p className="text-sm text-muted-foreground">
                We have your request for {existing.business_name}. We&apos;ll be
                in touch to confirm who you are before switching your account
                over.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-3xl bg-muted p-6 space-y-2">
                <p className="font-medium">Why we verify first</p>
                <p className="text-sm text-muted-foreground">
                  Anyone can claim to be a restaurant. We speak to every
                  business before switching the account over, so the commercial
                  circles on the map are all places that really exist and
                  really asked to be there. Tell us how to reach you and we
                  will call.
                </p>
              </div>

              {existing?.status === 'rejected' && (
                <p className="text-sm text-muted-foreground">
                  A previous request wasn&apos;t approved. You can send another.
                </p>
              )}

              <BusinessRequestForm />
            </>
          )}

        </div>
      </main>
    </>
  )
}
