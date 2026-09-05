'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { backfillNeighborhoods } from '@/app/actions/profile'

export default function BackfillButton() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    setStatus(null)
    const { updated, errors } = await backfillNeighborhoods()
    setLoading(false)
    if (updated === 0 && errors === 0) {
      setStatus('All circles already have neighborhoods.')
    } else {
      setStatus(`Updated ${updated} circle${updated !== 1 ? 's' : ''}${errors > 0 ? `, ${errors} failed` : ''}.`)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? 'Detecting...' : 'Fix neighborhoods for existing circles'}
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  )
}
