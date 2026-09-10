'use client'

import { useEffect, useRef } from 'react'

/**
 * Datamosh.
 *
 * The effect is a compression failure, so it is reproduced the way the failure
 * actually works rather than imitated with blur. A video codec sends a full
 * frame (I-frame) occasionally and, in between, only motion vectors saying
 * "this block moved there". Delete the I-frames and the vectors keep being
 * applied to whatever pixels happen to be on screen, so the picture smears
 * along paths that no longer belong to it.
 *
 * Here the canvas is never cleared. Each frame copies blocks of itself to a
 * neighbouring position, which is a motion vector applied to stale pixels, and
 * new shapes are only occasionally drawn in. The bloom you see is genuinely
 * accumulated error, not a filter.
 */

export default function DatamoshField() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const BLOCK = 18

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      w = Math.max(1, Math.floor(r.width))
      h = Math.max(1, Math.floor(r.height))
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const colour = getComputedStyle(wrap).color

    let t = 0
    let nextShape = 0
    let raf = 0
    let last = 0
    // Where the smear is currently pushing. Drifts, so the whole field leans.
    let vx = 0.6
    let vy = -0.35

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
      last = now
      t += dt

      // The vector field wanders, which is what makes the smear curve.
      vx += (Math.random() - 0.5) * 0.35
      vy += (Math.random() - 0.5) * 0.28
      vx = Math.max(-2.2, Math.min(2.2, vx))
      vy = Math.max(-1.6, Math.min(1.6, vy))

      // Apply motion vectors to blocks that were never re-encoded.
      const cols = Math.ceil(w / BLOCK)
      const rows = Math.ceil(h / BLOCK)
      for (let i = 0; i < 220; i++) {
        const bx = Math.floor(Math.random() * cols) * BLOCK
        const by = Math.floor(Math.random() * rows) * BLOCK
        const dx = Math.round(vx * (1.5 + Math.random() * 4))
        const dy = Math.round(vy * (1.5 + Math.random() * 4))
        ctx.drawImage(canvas, bx, by, BLOCK, BLOCK, bx + dx, by + dy, BLOCK, BLOCK)
      }

      // Bleed everything toward the background so the screen does not fill in.
      ctx.globalAlpha = 0.018
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      // A surviving P-frame: fresh content for the vectors to drag around.
      if (t > nextShape) {
        nextShape = t + 0.22 + Math.random() * 0.5
        const cx = Math.random() * w
        const cy = Math.random() * h
        const rad = 18 + Math.random() * 70
        ctx.strokeStyle = colour
        ctx.globalAlpha = 0.85
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.ellipse(cx, cy, rad, rad * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Occasional block corruption: a slab lifted from somewhere else.
      if (Math.random() < 0.14) {
        const sx = Math.floor(Math.random() * cols) * BLOCK
        const sy = Math.floor(Math.random() * rows) * BLOCK
        const dw = BLOCK * (2 + Math.floor(Math.random() * 5))
        const dh = BLOCK * (1 + Math.floor(Math.random() * 3))
        ctx.drawImage(
          canvas, sx, sy, dw, dh,
          Math.floor(Math.random() * cols) * BLOCK,
          Math.floor(Math.random() * rows) * BLOCK,
          dw, dh
        )
      }
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
      <canvas ref={canvasRef} className="absolute inset-0 opacity-60" />
    </div>
  )
}
