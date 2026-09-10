'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/AuthShell'

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
    <AuthShell altHref="/login" altLabel="Sign in">
      <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold lowercase">create your account</h2>
            <p className="text-muted-foreground text-sm mt-1">Free. No spam. Just your local circles.</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" type="text" placeholder="Your name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">@</span>
                <Input
                  id="instagram"
                  name="instagram"
                  type="text"
                  placeholder="yourhandle"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">so other people know you are real :)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                pattern="[A-Za-z0-9_]{3,20}"
                title="3-20 characters: letters, numbers or underscores"
                placeholder="yourname"
              />
              <p className="text-xs text-muted-foreground">
                Sign in with this instead of your email. You can add or change
                it later.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="8+ characters" minLength={8} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Join Circles'}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>
          </p>
      </div>
    </AuthShell>
  )
}
