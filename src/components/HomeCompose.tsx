'use client'

import { useState } from 'react'
import { createPost } from '@/app/actions/posts'
import { Button } from '@/components/ui/button'

type CircleOption = { id: string; name: string; emoji?: string | null }

/**
 * The circle-page composer knows which circle it is posting to. This one does
 * not, so it asks. Same action underneath.
 */
export default function HomeCompose({
  circles,
  authorName,
}: {
  circles: CircleOption[]
  authorName: string
}) {
  const [content, setContent] = useState('')
  const [circleId, setCircleId] = useState(circles[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (circles.length === 0) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim() || !circleId) return
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createPost(formData)

    if (result?.error) setError(result.error)
    else setContent('')
    setLoading(false)
  }

  const initials = authorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
        {initials}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <input type="hidden" name="circle_id" value={circleId} />
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with your circles..."
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground flex-shrink-0">to</span>
            <select
              value={circleId}
              onChange={(e) => setCircleId(e.target.value)}
              className="text-xs bg-background border border-input rounded-md px-2 py-1 max-w-[220px] truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">{content.length}/1000</span>
            <Button type="submit" size="sm" disabled={loading || !content.trim()}>
              {loading ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
