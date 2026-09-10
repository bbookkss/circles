'use client'

import { useEffect, useRef } from 'react'

/**
 * Full-bleed character field for the dark hero: light rain on a pond.
 *
 * Drops land at random and each sends out a packet of expanding rings that
 * decays as it travels. Nothing is drawn — every cell sums the waves passing
 * through it, and the picture emerges from where they reinforce and cancel.
 * Overlapping ripples are the whole point, so drops are deliberately frequent
 * enough that several are always in flight.
 *
 * Two `<pre>` layers because a single text node can only be one colour: dim
 * cells go in one, bright cells in the other, and the difference is what gives
 * the form its edge.
 *
 * Written straight to textContent rather than through React state — this
 * repaints ~12k characters several times a second, and reconciling that would
 * be absurd. React owns the two nodes; the loop owns their text.
 */

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const FPS = 16
/** Cells per second a ring front travels. */
const SPEED = 13
/** Seconds a drop lives before it has faded to nothing. */
const LIFE = 6
/** Half-width of the wave packet, in cells. Wider = more rings per drop. */
const PACKET = 5
const MAX_DROPS = 12

type Drop = { x: number; y: number; born: number; amp: number }

export default function AsciiField() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLPreElement>(null)
  const brightRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const dim = dimRef.current
    const bright = brightRef.current
    if (!wrap || !dim || !bright) return

    // Measure one character rather than assuming, so the grid stays aligned
    // whatever the font ends up being.
    const probe = document.createElement('span')
    probe.textContent = 'M'
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
    dim.appendChild(probe)
    const charW = probe.getBoundingClientRect().width || 6
    const lineH = probe.getBoundingClientRect().height || 10
    probe.remove()

    let cols = 0
    let rows = 0
    let seeds: number[] = []

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      cols = Math.max(20, Math.ceil(r.width / charW) + 1)
      rows = Math.max(10, Math.ceil(r.height / lineH) + 1)
      // A stable glyph per cell, so the field shimmers instead of boiling.
      seeds = new Array(cols * rows).fill(0).map(() => Math.random())
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = 0
    let t = 0
    let drops: Drop[] = []
    let nextDrop = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 1000 / FPS) return
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.05
      last = now
      t += dt

      // Rain. Irregular intervals so it never falls on a beat.
      if (t > nextDrop) {
        nextDrop = t + 0.28 + Math.random() * 0.5
        drops.push({
          x: Math.random() * cols,
          y: Math.random() * rows,
          born: t,
          amp: 0.7 + Math.random() * 0.6,
        })
        if (drops.length > MAX_DROPS) drops.shift()
      }
      drops = drops.filter((d) => t - d.born < LIFE)

      let dimOut = ''
      let brightOut = ''

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x

          let v = 0
          for (let k = 0; k < drops.length; k++) {
            const d = drops[k]
            const age = t - d.born
            const dx = x - d.x
            // Cells are about twice as tall as wide, so vertical distance
            // counts double or the ripples come out as ellipses.
            const dy = (y - d.y) * 2
            const dist = Math.sqrt(dx * dx + dy * dy)

            const front = age * SPEED
            const phase = dist - front
            if (phase > PACKET || phase < -PACKET) continue

            // A packet of rings inside a decaying envelope: several crests per
            // drop rather than one expanding circle.
            const envelope = 1 - Math.abs(phase) / PACKET
            const fade = (1 - age / LIFE) / (1 + front * 0.028)
            v += Math.cos(phase * 1.15) * envelope * fade * d.amp
          }

          v = Math.abs(v) * (0.55 + seeds[i] * 0.7)

          if (v > 0.13) {
            if (Math.random() < 0.08) seeds[i] = Math.random()
            const g = GLYPHS[Math.floor(seeds[i] * GLYPHS.length)]
            if (v > 0.30) {
              brightOut += g
              dimOut += ' '
            } else {
              dimOut += g
              brightOut += ' '
            }
          } else {
            dimOut += ' '
            brightOut += ' '
          }
        }
        dimOut += '\n'
        brightOut += '\n'
      }

      dim.textContent = dimOut
      bright.textContent = brightOut
    }

    if (reduced) {
      // A still pond is a blank screen, so lay down a few drops mid-life and
      // render exactly one frame of them.
      t = 1.2
      drops = [
        { x: cols * 0.25, y: rows * 0.3, born: 0.15, amp: 1 },
        { x: cols * 0.7, y: rows * 0.6, born: 0.5, amp: 0.9 },
        { x: cols * 0.45, y: rows * 0.85, born: 0.85, amp: 0.8 },
      ]
      nextDrop = Infinity
      draw(performance.now())
      cancelAnimationFrame(raf)
    } else {
      raf = requestAnimationFrame(draw)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
    >
      <pre
        ref={dimRef}
        className="absolute inset-0 m-0 font-mono text-[7px] md:text-[9px] leading-[1.05] whitespace-pre text-background/[0.085]"
      />
      <pre
        ref={brightRef}
        className="absolute inset-0 m-0 font-mono text-[7px] md:text-[9px] leading-[1.05] whitespace-pre text-background/[0.26]"
      />
    </div>
  )
}
