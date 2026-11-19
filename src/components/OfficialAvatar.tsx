import { MARK_SHOULDERS, MARK_HEAD_R } from '@/lib/mark'

/**
 * The Circles account's profile picture: the app icon in a circle, where a
 * person would show their initials. Foreground on background like the badge,
 * so it's ink on light pages and light on dark ones. Size it with className
 * (w-9 h-9 and so on) to match the avatars around it.
 */
export default function OfficialAvatar({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Circles"
      className={`inline-flex items-center justify-center rounded-full bg-foreground text-background flex-shrink-0 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="block w-[62%] h-[62%]" aria-hidden>
        <path d={MARK_SHOULDERS} fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
        <circle cx="10" cy="10" r={MARK_HEAD_R} fill="currentColor" />
      </svg>
    </span>
  )
}
