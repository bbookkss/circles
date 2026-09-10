'use client'

import { useEffect, useRef } from 'react'

/**
 * Full-bleed character field for the dark hero.
 *
 * The shape is not drawn — it emerges from which cells are lit. A field
 * function decides each cell's intensity, and intensity decides whether a
 * glyph appears and in which of two brightness layers. That is why it reads as
 * a form made of text rather than text arranged in a shape.
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
const FPS = 8

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

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 1000 / FPS) return
      last = now
      t += 0.016

      const cx = cols / 2
      const cy = rows / 2
      // Character cells are about twice as tall as wide.
      const scale = 1 / Math.min(cols / 2.2, rows * 1.9)

      let dimOut = ''
      let brightOut = ''

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          const dx = (x - cx) * scale
          const dy = (y - cy) * 2 * scale
          const d = Math.hypot(dx, dy)

          // Concentric rings that breathe outward, so the form is a set of
          // circles rather than a disc -- this is a site called circles.
          // Two ring sets at different frequencies, breathing outward at
          // different rates, so the interference keeps it from reading as a
          // printed contour map.
          const wave = Math.sin(d * 7 - t * 1.2) * 0.6 + Math.sin(d * 17 - t * 0.7) * 0.4

          // Gentle enough that the field still reaches the corners: dense in
          // the middle, thinning outward, never a hard edge.
          const falloff = Math.max(0, 1 - d * 0.42)
          let v = (wave * 0.5 + 0.5) * (0.35 + falloff * 0.8)

          // Per-cell noise keeps the rings from looking like printed contours.
          v *= 0.5 + seeds[i] * 0.95

          if (v > 0.40) {
            // Shimmer: a few percent of lit cells take a new glyph each frame.
            if (Math.random() < 0.06) seeds[i] = Math.random()
            const g = GLYPHS[Math.floor(seeds[i] * GLYPHS.length)]
            if (v > 0.62) {
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
      // One frame, then nothing moves.
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
        className="absolute inset-0 m-0 font-mono text-[7px] md:text-[9px] leading-[1.05] whitespace-pre text-background/[0.035]"
      />
      <pre
        ref={brightRef}
        className="absolute inset-0 m-0 font-mono text-[7px] md:text-[9px] leading-[1.05] whitespace-pre text-background/[0.075]"
      />
    </div>
  )
}
