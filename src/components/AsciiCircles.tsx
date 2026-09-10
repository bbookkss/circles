/**
 * Ambient ASCII circles for the dark hero.
 *
 * Rings are generated rather than pasted so a radius is one number, and the
 * whole field is CSS: two nested animations (a slow drift on the wrapper, a
 * pop on the glyphs) rather than JS, canvas or a timer. Transform and opacity
 * only, so it composites on the GPU and costs a phone essentially nothing.
 *
 * Deliberately near-invisible. It is texture behind the words, not a thing to
 * look at -- if you notice it before you read the headline, it is too strong.
 */

/** A monospace cell is about half as wide as it is tall, so x is scaled 2:1. */
function ring(radius: number, char: string): string {
  const lines: string[] = []
  for (let y = -radius; y <= radius; y++) {
    let line = ''
    for (let x = -radius * 2; x <= radius * 2; x++) {
      const d = Math.hypot(x / 2, y)
      line += Math.abs(d - radius) < 0.5 ? char : ' '
    }
    lines.push(line)
  }
  return lines.join('\n')
}

type Spec = {
  radius: number
  char: string
  /** Percentages, so the field reflows with the section. */
  top: string
  left: string
  /** Seconds. Staggered and mutually prime-ish so they never beat together. */
  pop: number
  drift: number
  delay: number
  opacity: number
}

const CIRCLES: Spec[] = [
  { radius: 7,  char: 'o', top: '12%', left: '6%',  pop: 11, drift: 29, delay: 0,   opacity: 0.032 },
  { radius: 12, char: '.', top: '58%', left: '2%',  pop: 17, drift: 37, delay: 3,   opacity: 0.028 },
  { radius: 5,  char: '*', top: '30%', left: '38%', pop: 9,  drift: 23, delay: 6,   opacity: 0.025 },
  { radius: 16, char: '.', top: '4%',  left: '62%', pop: 23, drift: 41, delay: 1.5, opacity: 0.022 },
  { radius: 9,  char: 'o', top: '74%', left: '48%', pop: 13, drift: 31, delay: 8,   opacity: 0.032 },
  { radius: 6,  char: '+', top: '84%', left: '78%', pop: 10, drift: 27, delay: 4.5, opacity: 0.025 },
  { radius: 20, char: '.', top: '40%', left: '80%', pop: 29, drift: 43, delay: 2,   opacity: 0.018 },
  { radius: 4,  char: '*', top: '18%', left: '24%', pop: 7,  drift: 19, delay: 9.5, opacity: 0.032 },
]

export default function AsciiCircles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
    >
      {CIRCLES.map((c, i) => (
        <div
          key={i}
          className="ascii-drift absolute"
          style={{
            top: c.top,
            left: c.left,
            animationDuration: `${c.drift}s`,
            animationDelay: `${c.delay / 2}s`,
          }}
        >
          <pre
            className="ascii-pop font-mono leading-[0.9] text-[10px] md:text-xs whitespace-pre"
            style={{
              animationDuration: `${c.pop}s`,
              animationDelay: `${c.delay}s`,
              ['--ascii-opacity' as string]: c.opacity,
            }}
          >
            {ring(c.radius, c.char)}
          </pre>
        </div>
      ))}
    </div>
  )
}
