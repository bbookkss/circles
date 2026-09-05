'use client'

import { useRouter } from 'next/navigation'
import Circled from '@/components/Circled'

// Routes to the actual previous page via browser history. Falls back to a
// sensible destination when there's no in-app history (e.g. the page was
// opened directly from a shared link).
export default function BackButton({
  fallback = '/home',
  label = '← back',
}: {
  fallback?: string
  label?: string
}) {
  const router = useRouter()

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <Circled>
      <button
        type="button"
        onClick={handleBack}
        className="text-sm text-muted-foreground hover:text-foreground px-2 py-1"
      >
        {label}
      </button>
    </Circled>
  )
}
