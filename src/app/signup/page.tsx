'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/AuthShell'

/**
 * Three fields. It used to be six.
 *
 * What went, and where it went instead:
 *
 *   Instagram   Was required, and was the highest-friction field on the form:
 *               a stranger's social handle, asked before they know what this
 *               is. It verified nothing either, being free text. Now optional
 *               on the profile, where the reason for giving it is obvious.
 *   Username    An alias for signing in. Useful later, noise now.
 *   Email opt-in  Asking permission to email someone about circles before
 *               they have seen a circle. It defaults off and lives on the
 *               profile, which is also the honest place for a consent
 *               checkbox nobody is being rushed past.
 *
 * The bar for a field here is: the account cannot exist without it.
 */
export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <AuthShell altHref="/login" altLabel="Log in">
      <div className="space-y-6">
          <div>
            <h1 className="text-[1.75rem] sm:text-[2.2rem]">Create your account</h1>
            <p className="text-muted-foreground mt-2">Takes a minute, and it&apos;s free.</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3.5 py-2.5 rounded-xl">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">Your name</Label>
              <Input id="full_name" name="full_name" type="text" placeholder="First and last" autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="8+ characters" autoComplete="new-password" minLength={8} required />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Creating your account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-[15px] text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 decoration-cool-2 hover:text-foreground">
              Log in
            </Link>
          </p>
      </div>
    </AuthShell>
  )
}
