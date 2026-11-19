'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/AuthShell'
import { updatePassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    // Redirects to /home on success and never returns.
    const result = await updatePassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <AuthShell altHref="/login" altLabel="Log in">
      <div className="space-y-6">

        <div>
          <h1 className="text-[1.75rem] sm:text-[2.2rem]">Choose a new password</h1>
          <p className="text-muted-foreground mt-2">
            You&apos;ll be signed in once it&apos;s saved.
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Save password'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          <Link href="/login" className="underline underline-offset-4 decoration-cool-2 hover:text-foreground">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
