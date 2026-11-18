'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resolveReport } from '@/app/actions/safety'

type Action = 'remove' | 'actioned' | 'dismissed'

export default function ReportActions({ reportId, canRemove }: { reportId: string; canRemove: boolean }) {
  const [loading, setLoading] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: Action) {
    setLoading(action)
    setError(null)
    const formData = new FormData()
    formData.set('report_id', reportId)
    formData.set('action', action)
    const result = await resolveReport(formData)
    if ('error' in result) setError(result.error)
    setLoading(null)
  }

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex flex-wrap gap-2">
        {canRemove && (
          <Button size="sm" variant="destructive" disabled={loading !== null} onClick={() => act('remove')}>
            {loading === 'remove' ? 'Removing…' : 'Remove it'}
          </Button>
        )}
        <Button size="sm" disabled={loading !== null} onClick={() => act('actioned')}>
          {loading === 'actioned' ? 'Saving…' : 'Handled'}
        </Button>
        <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => act('dismissed')}>
          {loading === 'dismissed' ? 'Dismissing…' : 'Dismiss'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
