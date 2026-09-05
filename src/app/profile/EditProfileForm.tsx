'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/app/actions/profile'

export default function EditProfileForm({ fullName }: { fullName: string }) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await updateProfile(formData)
    setLoading(false)
    setEditing(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        {success && <p className="text-sm text-green-600">Saved!</p>}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit name
        </Button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-3 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>
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
