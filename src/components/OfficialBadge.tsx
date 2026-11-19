import { MARK_SHOULDERS, MARK_HEAD_R } from '@/lib/mark'

/**
 * The official mark, shown after the Circles account's name: the app icon in
 * small, still (it would be noise spinning next to text). Foreground on
 * background, so it is ink on light pages and light on dark ones, readable in
 * both themes. Sized in em so it matches whatever text it follows.
 */
export default function OfficialBadge({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Official Circles account"
      title="Official Circles account"
      className={`inline-grid place-items-center align-[-0.12em] ml-[0.3em] w-[1em] h-[1em] rounded-[0.26em] bg-foreground text-background shrink-0 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="w-[72%] h-[72%]" aria-hidden>
        <path d={MARK_SHOULDERS} fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
        <circle cx="10" cy="10" r={MARK_HEAD_R} fill="currentColor" />
      </svg>
    </span>
  )
}
