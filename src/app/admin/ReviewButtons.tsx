'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { reviewBusinessRequest } from '@/app/actions/business'

export default function ReviewButtons({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function review(approve: boolean) {
    setLoading(approve ? 'approve' : 'reject')
    setError(null)
    const formData = new FormData()
    formData.set('request_id', requestId)
    formData.set('approve', String(approve))
    const result = await reviewBusinessRequest(formData)
    if (result?.error) setError(result.error)
    setLoading(null)
  }

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-2">
        <Button size="sm" disabled={loading !== null} onClick={() => review(true)}>
          {loading === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => review(false)}
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
