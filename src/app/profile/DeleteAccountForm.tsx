'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/app/actions/auth'

export default function DeleteAccountForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    // On success this redirects and never returns.
    const result = await deleteAccount(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Delete account
      </Button>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4 border border-destructive/40 rounded-xl p-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Delete your account</p>
        <p className="text-sm text-muted-foreground">
          This cannot be undone. Here is exactly what happens:
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Your profile, memberships, follows, likes and messages are erased.</li>
          <li>
            Your posts and comments stay in their circles, shown as{' '}
            <span className="font-medium">Deleted user</span>, so conversations
            still make sense to everyone else.
          </li>
          <li>
            Any circle where you are the only admin is handed to its
            longest-standing member.
          </li>
          <li>Any circle where you are the last member is deleted.</li>
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">
          Type <span className="font-mono font-medium">delete</span> to confirm
        </Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="delete"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={loading || confirm.trim().toLowerCase() !== 'delete'}
        >
          {loading ? 'Deleting…' : 'Delete my account'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setOpen(false)
            setConfirm('')
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
