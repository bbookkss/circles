'use client'

import { LOCATION_EXPLAINER } from './useNearMe'

/**
 * The step between "Use my location" and the browser's own prompt: what we
 * do with it, in one short paragraph, and a choice. The browser asks only
 * after Allow.
 */
export default function LocationConsent({ onAllow, onCancel, className = '' }: { onAllow: () => void; onCancel: () => void; className?: string }) {
  return (
    <div role="group" aria-label="Use your location" className={`rounded-2xl px-3.5 py-3 text-sm ${className}`}>
      <p className="font-medium">Use your location?</p>
      <p className="text-muted-foreground mt-1 leading-snug">{LOCATION_EXPLAINER}</p>
      <div className="flex gap-2 mt-2.5">
        <button type="button" onClick={onAllow} className="h-8 px-3.5 rounded-full bg-foreground text-background text-[13px] font-medium">
          Allow
        </button>
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-full text-[13px] text-muted-foreground hover:text-foreground">
          Not now
        </button>
      </div>
    </div>
  )
}
