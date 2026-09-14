'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { unsubscribeByToken } from '@/app/actions/email'

/**
 * The confirm-then-act half of the unsubscribe page.
 *
 * A client component so the result can replace the form in place. Somebody
 * clicking unsubscribe from an inbox wants one screen, not a redirect chain,
 * and certainly not to wonder whether it worked.
 */
export default function UnsubscribeForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  if (state === 'done') {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl">Unsubscribed</h1>
        <p className="text-sm text-muted-foreground">
          We will not email <span className="text-foreground">{email}</span> about
          circles again. Your account and your circles are untouched.
        </p>
        <p className="text-xs text-muted-foreground pt-2">
          Password resets still work. Those are not marketing, and you would be
          stuck without them.
        </p>
        <Link
          href="/"
          className="text-sm underline underline-offset-4 inline-block pt-2"
        >
          Back to Circles
        </Link>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      action={async () => {
        setState('working')
        const result = await unsubscribeByToken(token)
        setState(result.ok ? 'done' : 'error')
      }}
    >
      <div className="space-y-2">
        <h1 className="text-3xl">Stop these emails?</h1>
        <p className="text-sm text-muted-foreground">
          This turns off meet reminders for{' '}
          <span className="text-foreground">{email}</span>. You stay in your
          circles and nothing else changes.
        </p>
      </div>

      {state === 'error' && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          That did not save. Try again, and if it keeps failing reply to the
          email you got and we will do it by hand.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={state === 'working'}>
          {state === 'working' ? 'Unsubscribing...' : 'Unsubscribe'}
        </Button>
        <Link href="/">
          <Button type="button" variant="outline">
            Keep them
          </Button>
        </Link>
      </div>
    </form>
  )
}
