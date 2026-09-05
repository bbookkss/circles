'use client'

import { useState, useRef } from 'react'
import { createPost } from '@/app/actions/posts'
import { Button } from '@/components/ui/button'

export default function PostCompose({ circleId, authorName }: { circleId: string; authorName: string }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createPost(formData)

    if (result?.error) {
      setError(result.error)
    } else {
      setContent('')
    }
    setLoading(false)
  }

  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
        {initials}
      </div>
      <div className="flex-1 space-y-2">
        <input type="hidden" name="circle_id" value={circleId} />
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Post an update, share something..."
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{content.length}/1000</span>
          <Button type="submit" size="sm" disabled={loading || !content.trim()}>
            {loading ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  )
}
