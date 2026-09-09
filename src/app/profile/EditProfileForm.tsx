'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/app/actions/profile'

export default function EditProfileForm({
  fullName,
  bio,
  instagram,
  username,
}: {
  fullName: string
  bio: string | null
  instagram: string | null
  username: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await updateProfile(formData)
    setLoading(false)
    // A taken username has to surface, not vanish into a "Saved!" that lied.
    if (result?.error) {
      setError(result.error)
      return
    }
    setEditing(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (!editing) {
    return (
      <div className="space-y-1">
        {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
        <div className="flex items-center gap-3 pt-1">
          {success && <p className="text-sm text-green-600">Saved!</p>}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-3 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="username">
          Username <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="username"
          name="username"
          defaultValue={username ?? ''}
          placeholder="yourname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3-20 characters: letters, numbers or underscores"
        />
        <p className="text-xs text-muted-foreground">Sign in with this instead of your email.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="instagram">Instagram</Label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={instagram ?? ''}
            placeholder="yourhandle"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <p className="text-xs text-muted-foreground">Links to your Instagram so people can find you.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="bio">Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio ?? ''}
          placeholder="Tell people a bit about yourself..."
          rows={3}
          maxLength={200}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
