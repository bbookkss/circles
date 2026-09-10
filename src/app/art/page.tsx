import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DemoWheel from '@/components/DemoWheel'
import AsciiField from '@/components/AsciiField'
import CrtField from '@/components/art/CrtField'
import DatamoshField from '@/components/art/DatamoshField'
import BlobField from '@/components/art/BlobField'
import DitherField from '@/components/art/DitherField'

// TEMPORARY: renders the hero under each background treatment so they can be
// compared against the current one. Deleted once one is picked.

const STYLES = [
  {
    slug: 'current',
    name: 'Current, ascii ripples',
    note: 'What is live now, for reference.',
    Field: AsciiField,
  },
  {
    slug: 'crt',
    name: 'CRT',
    note: 'Scanline gaps, beam bloom, convergence error and a drifting vertical hold. The picture is the same rings; the tube is the treatment.',
    Field: CrtField,
  },
  {
    slug: 'datamosh',
    name: 'Datamosh',
    note: 'The canvas is never cleared. Blocks are copied to a neighbouring position each frame, which is a motion vector applied to stale pixels. The smear is accumulated error, not a blur.',
    Field: DatamoshField,
  },
  {
    slug: 'blob',
    name: 'Blob tracking',
    note: 'Bounding brackets, centroids, track ids, confidence, and dashed links to nearby tracks. A CV pipeline noticing things and following them while they stay in frame.',
    Field: BlobField,
  },
  {
    slug: 'dither',
    name: '1-bit dither',
    note: 'No grey at all. A 4x4 Bayer matrix decides each cell on or off, so shading is purely how many cells are lit. Ordered, not error-diffused, so it does not boil as it moves.',
    Field: DitherField,
  },
]

export default async function ArtPreview({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>
}) {
  const { style } = await searchParams
  const shown = style ? STYLES.filter((s) => s.slug === style) : STYLES
  return (
    <main>
      {shown.map(({ name, note, Field }) => (
        <section key={name}>
          <div className="bg-background text-foreground px-6 py-3 border-b text-xs">
            <span className="font-bold">{name}</span>
            <span className="text-muted-foreground"> — {note}</span>
          </div>

          <div className="relative overflow-hidden bg-foreground text-background">
            <Field />

            <header className="relative mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
              <p className="font-bold text-lg tracking-tight lowercase">circles</p>
              <span className="text-sm text-background/70">Sign in</span>
            </header>

            <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 md:pb-24 md:pt-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              <div>
                <h1 className="text-4xl md:text-[2.5rem] font-bold leading-[1.1] lowercase text-balance">
                  find your people.<br />
                  <span className="text-background/55">create your circle.</span>
                </h1>
                <p className="text-background/70 text-base md:text-lg mt-5 max-w-md">
                  Groups that meet on a schedule, close enough to walk to. See
                  who&apos;s coming before you go.
                </p>
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link href="/signup">
                    <Button size="lg" className="bg-background text-foreground hover:bg-background/90">
                      Get started
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button
                      size="lg"
                      className="bg-transparent border border-background/30 text-background hover:bg-background/10"
                    >
                      Sign in
                    </Button>
                  </Link>
                </div>
              </div>

              <div>
                <DemoWheel className="h-[380px] md:h-[520px]" />
              </div>
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
