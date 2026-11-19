import Link from 'next/link'
import AuthShell from '@/components/AuthShell'

export default function CheckEmailPage() {
  return (
    <AuthShell altHref="/login" altLabel="Log in">
      <div className="space-y-4">
        <h1 className="text-[1.75rem] sm:text-[2.2rem]">Check your email</h1>
        <p className="text-muted-foreground">
          We sent you a link to confirm your account. Open it on this device, then come back here to log in.
        </p>
        <Link
          href="/login"
          className="inline-block text-[15px] underline underline-offset-4 decoration-cool-2 hover:decoration-current"
        >
          Back to log in
        </Link>
      </div>
    </AuthShell>
  )
}
