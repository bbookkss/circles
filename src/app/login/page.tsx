'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      setError(isInvalidCreds ? "No account found, or password is incorrect." : result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — hero */}
      <div className="relative overflow-hidden bg-foreground text-background flex flex-col justify-center px-8 py-12 md:w-1/2 md:min-h-screen">
        {/* Ambient hand-drawn circle in the background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/circle-draw.gif"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute -right-24 -bottom-28 w-[520px] max-w-none opacity-[0.08]"
        />
        <div className="relative max-w-sm mx-auto w-full fade-rise">
          {/* Wordmark with a circle drawing itself around it */}
          <div className="relative w-fit mb-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/circle-draw.gif"
              alt=""
              aria-hidden
              className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 max-w-none opacity-90"
            />
            <p className="relative text-3xl font-bold tracking-tight lowercase px-7 py-3">circles</p>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4 lowercase">
            find your people.
          </h1>
          <p className="text-background/70 text-base mb-8">
            Recurring local gatherings: pickup sports, music sessions, neighborhood dinners, and more.
          </p>
          <ul className="space-y-3 text-sm text-background/80">
            <li className="flex items-start gap-3">
              <span className="text-background/40 select-none">·</span>
              <span>Browse circles near you on an interactive map</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-background/40 select-none">·</span>
              <span>Join groups with regular schedules, not one-off events</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-background/40 select-none">·</span>
              <span>Public circles anyone can join. Private ones by invite.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col justify-center px-8 py-12 md:w-1/2 md:min-h-screen bg-background">
        <div className="max-w-sm mx-auto w-full space-y-6 fade-rise stagger-1">
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
      </div>
    </div>
  )
}
