'use client'

import { useState } from 'react'
import Link from 'next/link'
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/login" className="font-bold text-lg lowercase tracking-tight block">
          circles
        </Link>

        {sent ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If that address has an account, we&apos;ve sent a link to reset
              your password. The link expires after an hour.
            </p>
            <Link href="/login" className="text-sm underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter the email you signed up with and we&apos;ll send you a
                link. Username won&apos;t work here — we need somewhere to send
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center">
              <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
