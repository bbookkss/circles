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
      setError(isInvalidCreds ? 'No account found, or password is incorrect.' : result.error)
      setLoading(false)
    }
  }

  return (
    <AuthShell altHref="/signup" altLabel="Create an account">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold lowercase">welcome back</h2>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md space-y-1">
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
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          New to Circles?{' '}
          <Link href="/signup" className="underline underline-offset-4 hover:text-foreground">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
