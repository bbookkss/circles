import Link from 'next/link'
import { whoIsUnsubscribing } from '@/app/actions/email'
import UnsubscribeForm from '@/components/UnsubscribeForm'

/**
 * Unsubscribe landing page. Public on purpose.
 *
 * Loading the page changes nothing; the button does. That split is not
 * ceremony. Mail clients and corporate scanners fetch every link in a message
 * to check it is safe, so a GET that unsubscribes would quietly opt people
 * out before they had read the email. The act is a POST for the same reason
 * Gmail's one-click header uses one.
 */

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const who = token ? await whoIsUnsubscribing(token) : null

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="font-display font-semibold text-[1.35rem] tracking-tight block">
          circles
        </Link>

        {!who ? (
          <div className="space-y-2">
            <h1 className="text-3xl">Link expired</h1>
            <p className="text-sm text-muted-foreground">
              This unsubscribe link is no longer valid. If you are still getting
              emails you did not ask for, use the link in the most recent one, or
              turn reminders off in your profile.
            </p>
            <Link
              href="/profile"
              className="text-sm underline underline-offset-4 inline-block pt-2"
            >
              Go to your profile
            </Link>
          </div>
        ) : (
          <UnsubscribeForm token={token!} email={who.email} />
        )}
      </div>
    </main>
  )
}
