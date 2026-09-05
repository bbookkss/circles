'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — hero */}
      <div className="bg-foreground text-background flex flex-col justify-center px-8 py-12 md:w-1/2 md:min-h-screen">
        <div className="max-w-sm mx-auto w-full">
          <p className="text-2xl font-bold tracking-tight mb-2">Circles</p>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Your neighborhood is more interesting than you think.
          </h1>
          <p className="text-background/70 text-base mb-8">
            Circles connects you with recurring local groups — the people who show up to the same beach, park, or coffee shop every week.
          </p>
          <ul className="space-y-3 text-sm text-background/80">
            <li className="flex items-start gap-3">
              <span className="mt-0.5">👥</span>
              <span>Join existing circles or start your own</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5">📍</span>
              <span>Every circle has a real place and a regular time</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5">🔒</span>
              <span>Private circles let you control who gets in</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col justify-center px-8 py-12 md:w-1/2 md:min-h-screen bg-background">
        <div className="max-w-sm mx-auto w-full space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground text-sm mt-1">Free. No spam. Just your local circles.</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" type="text" placeholder="Ben Bookstaver" required />
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
      </div>
    </div>
  )
}
