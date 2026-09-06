'use client'

import { useState } from 'react'

// Wraps any link/button/text and draws a hand-sketched oval around it on hover
// (desktop) or tap (mobile). The oval stretches to fit whatever it wraps.
// Remounting the <img> with a fresh key replays the GIF from frame one each time.
export default function Circled({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [playKey, setPlayKey] = useState<number | null>(null)

  const play = () => setPlayKey(Date.now())
  const stop = () => setPlayKey(null)

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      onTouchStart={play}
    >
      {playKey !== null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={playKey}
          src="/circle-draw.gif"
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 h-full w-full max-w-none brightness-0 opacity-70"
          style={{ transform: 'scale(1.15, 1.65)' }}
        />
      )}
      <span className="relative">{children}</span>
    </span>
  )
}
