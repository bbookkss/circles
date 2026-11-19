'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/AuthShell'
import { requestPasswordReset } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await requestPasswordReset(formData)
    setLoading(false)
    if (result?.error) setError(result.error)
    else setSent(true)
  }

  return (
    <AuthShell altHref="/login" altLabel="Log in">
      <div className="space-y-6">

        {sent ? (
          <div className="space-y-3">
            <h1 className="text-[1.75rem] sm:text-[2.2rem]">Check your email</h1>
            <p className="text-muted-foreground mt-2">
              If that address has an account, we&apos;ve sent a link to reset
              your password. The link expires after an hour.
            </p>
            <Link href="/login" className="inline-block text-[15px] underline underline-offset-4 decoration-cool-2 hover:decoration-current">
              Back to log in
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-[1.75rem] sm:text-[2.2rem]">Reset your password</h1>
              <p className="text-muted-foreground mt-2">
                Enter the email you signed up with and we&apos;ll send you a
                link. Username won&apos;t work here. We need somewhere to send
                it.
              </p>
            </div>

            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center">
              <Link href="/login" className="underline underline-offset-4 decoration-cool-2 hover:text-foreground">
                Back to log in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthShell>
  )
}
