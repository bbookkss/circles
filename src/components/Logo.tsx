/**
 * The Circles mark: a dot inside a ring of five dashes that turns once a
 * minute (globals.css, .logo-ring; still under reduced motion). Wrap it in an
 * element with .logo-busy to make the ring turn faster while something is
 * working, as the assistant does.
 */
export default function Logo({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className={`block overflow-visible ${className}`}>
      <circle
        className="logo-ring"
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={50}
        strokeDasharray="6.4 3.6"
      />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}
