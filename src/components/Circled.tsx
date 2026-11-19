/**
 * Used to draw a hand-sketched oval (a GIF) around whatever it wrapped, on
 * hover. The redesign (2026-11-18) dropped it: decoration on every link read
 * as a gimmick next to the quieter type. Kept as a pass-through so existing
 * imports still work; remove the wrappers as their files are touched.
 */
export default function Circled({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={`inline-flex items-center ${className ?? ''}`}>{children}</span>
}
