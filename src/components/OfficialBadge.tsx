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
      // inline-flex centring is exact where inline-grid let the svg sit on a
      // text baseline; align-middle lines the square up with the text's middle
      // rather than letting it hang below the baseline.
      className={`inline-flex items-center justify-center align-middle -translate-y-[0.06em] ml-[0.3em] w-[0.95em] h-[0.95em] rounded-[0.26em] bg-foreground text-background shrink-0 ${className}`}
    >
      <svg viewBox="0 0 20 20" className="block w-[72%] h-[72%]" aria-hidden>
        <path d={MARK_SHOULDERS} fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
        <circle cx="10" cy="10" r={MARK_HEAD_R} fill="currentColor" />
      </svg>
    </span>
  )
}
