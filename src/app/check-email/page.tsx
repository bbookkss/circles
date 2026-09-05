import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <p className="text-5xl">📬</p>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent you a confirmation link. Click it to activate your account, then come back here to sign in.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
