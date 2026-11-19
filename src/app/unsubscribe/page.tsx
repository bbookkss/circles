import Link from 'next/link'
import AuthShell from '@/components/AuthShell'
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
    <AuthShell altHref="/" altLabel="Circles">
      <div className="space-y-6">

        {!who ? (
          <div className="space-y-2">
            <h1 className="text-[1.75rem] sm:text-[2.2rem]">That link has expired</h1>
            <p className="text-muted-foreground mt-2">
              This unsubscribe link no longer works. Use the link in the most
              recent email, or turn reminders off in your profile.
            </p>
            <Link
              href="/profile"
              className="text-[15px] underline underline-offset-4 decoration-cool-2 hover:decoration-current inline-block pt-3"
            >
              Go to your profile
            </Link>
          </div>
        ) : (
          <UnsubscribeForm token={token!} email={who.email} />
        )}
      </div>
    </AuthShell>
  )
}
