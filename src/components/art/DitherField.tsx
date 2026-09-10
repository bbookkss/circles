'use client'

import { useEffect, useRef } from 'react'

/**
 * 1-bit dither.
 *
 * There is no grey. Every cell is either the paper colour or nothing, and the
 * appearance of shading comes entirely from how many cells in a neighbourhood
 * are on, which is what dithering is.
 *
 * The threshold comes from a 4x4 Bayer matrix rather than error diffusion:
 * ordered dithering keeps a stable crosshatch as the image moves, where
 * Floyd-Steinberg would boil, because each cell's decision depends only on its
 * own position and not on its neighbours' errors.
 *
 * Computed at CELL-sized resolution on a small offscreen canvas and scaled up
 * with smoothing off, so the pixels stay square and hard.
 */

/** Screen pixels per dithered cell. */
const CELL = 3

// Bayer 4x4, the classic ordered-dither threshold map.
const BAYER = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map((v) => (v + 0.5) / 16)

export default function DitherField() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d', { willReadFrequently: true })
    if (!bctx) return

    let w = 0
    let h = 0
    let gw = 0
    let gh = 0
    let img: ImageData | null = null

    // Paper colour, read from the class rather than hardcoded. It cannot be
    // parsed out of the string: this theme is authored in oklch, and
    // getComputedStyle hands back lab(...), whose first three numbers are not
    // r, g and b. Painting it and reading the pixel back makes the browser do
    // the conversion, and works whatever colour syntax the theme uses.
    const swatch = document.createElement('canvas')
    swatch.width = 1
    swatch.height = 1
    const sctx = swatch.getContext('2d', { willReadFrequently: true })
    let fr = 236
    let fg = 227
    let fb = 213
    if (sctx) {
      sctx.fillStyle = getComputedStyle(wrap).color
      sctx.fillRect(0, 0, 1, 1)
      const px = sctx.getImageData(0, 0, 1, 1).data
      fr = px[0]
      fg = px[1]
      fb = px[2]
    }

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      w = r.width
      h = r.height
      gw = Math.max(1, Math.ceil(w / CELL))
      gh = Math.max(1, Math.ceil(h / CELL))
      buf.width = gw
      buf.height = gh
      canvas.width = gw
      canvas.height = gh
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.imageSmoothingEnabled = false
      img = bctx.createImageData(gw, gh)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    type Drop = { x: number; y: number; born: number }
    let drops: Drop[] = []
    let t = 0
    let next = 0
    let raf = 0
    let last = 0

    const LIFE = 5
    const SPEED = 26

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      // 24fps: hard pixels look wrong when they move too smoothly.
      if (now - last < 1000 / 24) return
      const dt = last ? Math.min((now - last) / 1000, 0.06) : 0.03
      last = now
      t += dt

      if (t > next) {
        next = t + 0.5 + Math.random() * 0.9
        drops.push({ x: Math.random() * gw, y: Math.random() * gh, born: t })
        if (drops.length > 10) drops.shift()
      }
      drops = drops.filter((d) => t - d.born < LIFE)
      if (!img) return

      const data = img.data
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          // Continuous field first. The 1-bit step happens only at the end.
          let v = 0
          for (const d of drops) {
            const age = t - d.born
            const dist = Math.hypot(x - d.x, (y - d.y) * 1.15)
            const front = age * SPEED
            const phase = dist - front
            if (phase > 9 || phase < -9) continue
            const env = 1 - Math.abs(phase) / 9
            v += Math.cos(phase * 0.55) * env * (1 - age / LIFE)
          }
          v = Math.abs(v) * 0.85

          const i = (y * gw + x) * 4
          const on = v > BAYER[(y % 4) * 4 + (x % 4)]
          data[i] = fr
          data[i + 1] = fg
          data[i + 2] = fb
          data[i + 3] = on ? 255 : 0
        }
      }

      bctx.putImageData(img, 0, 0)
      ctx.clearRect(0, 0, gw, gh)
      ctx.drawImage(buf, 0, 0)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-background"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-70"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
