import Link from 'next/link'
import { Button } from '@/components/ui/button'
import HeatMap, { type HeatArea } from '@/components/HeatMap'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * The frame for signing in, signing up and the password pages: a short strip
 * of the drawn map that fades into the paper, with the form on a glass sheet
 * overlapping it. Quiet on purpose: the form is the only thing to do here.
 *
 * Same glass pill nav as the landing page, so arriving from it changes only
 * what's under the nav.
 */

const STRIP: HeatArea[] = [
  { x: 0.18, y: 0.35, r: 90, temp: 0.55 },
  { x: 0.52, y: 0.22, r: 70, temp: 0.4 },
  { x: 0.82, y: 0.4, r: 100, temp: 0.75 },
]

export default function AuthShell({
  altHref,
  altLabel,
  children,
}: {
  /** Where the nav sends someone who came to the wrong one of the pair. */
  altHref: string
  altLabel: string
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <nav className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-50 px-3 pt-2 pointer-events-none">
        <div className="glass pointer-events-auto mx-auto max-w-3xl h-12 rounded-full flex items-center gap-1 pl-4 pr-1.5">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight">
            <Logo />
            Circles
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href={altHref}><Button size="sm">{altLabel}</Button></Link>
          </div>
        </div>
      </nav>

      {/* The strip fades out at the bottom so the sheet sits on paper. */}
      <section
        aria-hidden
        className="h-[220px] sm:h-[300px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <HeatMap areas={STRIP} seed={13} />
      </section>

      <div className="relative z-[1] -mt-[120px] sm:-mt-[150px] px-4 pb-24">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="glass rounded-[28px] p-5 sm:p-8 fade-rise">
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}
