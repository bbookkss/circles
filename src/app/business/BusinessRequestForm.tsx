'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitBusinessRequest } from '@/app/actions/business'

export default function BusinessRequestForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await submitBusinessRequest(formData)
    setLoading(false)
    if (result?.error) setError(result.error)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="border rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold">Request received</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll be in touch to confirm who you are before switching your
          account over. Nothing changes until then.
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" name="business_name" required placeholder="Rosa's Cantina" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact_name">Your name</Label>
        <Input id="contact_name" name="contact_name" placeholder="Who are we speaking to?" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="(415) 555-0134" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="rosa@cantina.com" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">What would you run?</Label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Taco Tuesdays, live music Fridays…"
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Request business access'}
      </Button>
    </form>
  )
}
