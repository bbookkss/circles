'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/AuthShell'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setNotFound(false)
    const result = await login(formData)
    if (result?.error) {
      const isInvalidCreds = result.error.toLowerCase().includes('invalid login credentials')
      setNotFound(isInvalidCreds)
      setError(isInvalidCreds ? 'No account matches that, or the password is wrong.' : result.error)
      setLoading(false)
    }
  }

  return (
    <AuthShell altHref="/signup" altLabel="Sign up">
      <div className="space-y-6">
        <div>
          <h1 className="text-[1.75rem] sm:text-[2.2rem]">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Log in to see who is coming this week.</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3.5 py-2.5 rounded-xl space-y-1">
              <p>{error}</p>
              {notFound && (
                <p>
                  <Link href="/signup" className="underline underline-offset-4 font-medium">
                    Create an account instead?
                  </Link>
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or username</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com or yourname"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline underline-offset-4 decoration-cool-2 hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="text-[15px] text-muted-foreground text-center">
          New to Circles?{' '}
          <Link href="/signup" className="underline underline-offset-4 hover:text-foreground">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
