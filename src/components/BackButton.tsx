'use client'

import { useRouter } from 'next/navigation'

// Routes to the actual previous page via browser history. Falls back to a
// sensible destination when there's no in-app history (e.g. the page was
// opened directly from a shared link).
export default function BackButton({
  fallback = '/home',
  label = 'Back',
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
    <button type="button" onClick={handleBack} className="pill-btn pl-2.5 shrink-0">
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      {label}
    </button>
  )
}
