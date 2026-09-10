import Link from 'next/link'
import AsciiField from '@/components/AsciiField'

/**
 * The landing hero, reused as the frame for signing in and signing up.
 *
 * Login used to be a hard 50/50 split with its own background motif and no
 * header, so arriving from the landing page changed the layout, the wordmark,
 * the tagline's line breaks and the ambient animation all at once. Here the
 * shell does not move at all: same field, same header, same left column, same
 * grid. Only the right-hand slot changes — the demo column on the landing
 * page, the form here — so the page you asked for is the only thing that
 * arrives.
 */

export default function AuthShell({
  altHref,
  altLabel,
  children,
}: {
  /** Where the header sends someone who came to the wrong one of the pair. */
  altHref: string
  altLabel: string
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-foreground text-background">
      <AsciiField />

      <header className="relative mx-auto w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight lowercase">
          circles
        </Link>
        <Link
          href={altHref}
          className="text-sm text-background/70 hover:text-background transition-colors"
        >
          {altLabel}
        </Link>
      </header>

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-6 md:pb-24 md:pt-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Same copy, same sizes, same breaks as the landing hero. */}
        <div className="fade-rise">
          <h1 className="text-4xl md:text-[2.5rem] font-bold leading-[1.1] lowercase text-balance">
            find your people.<br />
            <span className="text-background/55">create your circle.</span>
          </h1>
          <p className="text-background/70 text-base md:text-lg mt-5 max-w-md">
            Groups that meet on a schedule, close enough to walk to. See who&apos;s
            coming before you go.
          </p>
          {/* The landing hero carries a button row here (mt-8 on a size="lg"
              button, so 32px + 36px). The grid is items-center, so leaving it
              out lifts this whole column by half of that and the tagline steps
              34px up the moment you navigate. Reserve the space instead. */}
          <div aria-hidden className="hidden md:block mt-8 h-9" />
        </div>

        {/* The form sits where the demo column sits, as lit paper on the dark.
            Matching the demo's height matters: the grid is items-center, so a
            shorter right column would pull the tagline up and the copy would
            visibly jump on the way in from the landing page. min-h, not h:
            the signup form is taller than 520 and must be allowed to grow. */}
        <div className="fade-rise stagger-1 w-full md:min-h-[520px] flex items-center md:justify-end">
          <div className="w-full max-w-md">
            <div className="rounded-2xl bg-background text-foreground p-7 md:p-8 shadow-lg shadow-black/20">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
