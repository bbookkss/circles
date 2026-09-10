'use client'

import { useEffect, useRef } from 'react'

/**
 * Blob tracking.
 *
 * The debug overlay of a computer-vision pipeline: connected regions found in
 * a frame, each with a bounding box, a centroid, a persistent track id and a
 * confidence. Tracks link to their nearest neighbour when they are close
 * enough, which is the association step drawn rather than described.
 *
 * It suits this product more than it looks like it should. The whole app is
 * about a handful of people who keep showing up in the same place, and this is
 * a picture of exactly that: things being noticed, given an identity, and
 * followed while they stay in frame.
 */

type Blob = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  conf: number
  born: number
}

const LIFE = 11

export default function BlobField() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const colour = getComputedStyle(wrap).color
    let nextId = 1
    let blobs: Blob[] = []
    let t = 0
    let next = 0
    let raf = 0
    let last = 0

    const spawn = () => {
      blobs.push({
        id: nextId++,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 26,
        vy: (Math.random() - 0.5) * 20,
        r: 16 + Math.random() * 46,
        conf: 0.62 + Math.random() * 0.37,
        born: t,
      })
      if (blobs.length > 9) blobs.shift()
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
      last = now
      t += dt

      if (t > next) {
        next = t + 0.9 + Math.random() * 1.6
        spawn()
      }
      blobs = blobs.filter((b) => t - b.born < LIFE)

      ctx.clearRect(0, 0, w, h)
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'top'

      for (const b of blobs) {
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (b.x < b.r || b.x > w - b.r) b.vx *= -1
        if (b.y < b.r || b.y > h - b.r) b.vy *= -1

        const age = t - b.born
        // Fade in as the tracker gains confidence, out as it loses the blob.
        const fade = Math.min(1, age / 0.7) * Math.min(1, (LIFE - age) / 1.2)

        // The detected region itself.
        ctx.globalAlpha = fade * 0.1
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.ellipse(b.x, b.y, b.r, b.r * 0.78, 0, 0, Math.PI * 2)
        ctx.fill()

        // Bounding box, drawn as corner brackets the way trackers tend to.
        const bw = b.r
        const bh = b.r * 0.78
        const c = Math.min(bw, bh) * 0.34
        ctx.globalAlpha = fade * 0.5
        ctx.strokeStyle = colour
        ctx.lineWidth = 1
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = b.x + sx * bw
          const py = b.y + sy * bh
          ctx.beginPath()
          ctx.moveTo(px - sx * c, py)
          ctx.lineTo(px, py)
          ctx.lineTo(px, py - sy * c)
          ctx.stroke()
        }

        // Centroid.
        ctx.globalAlpha = fade * 0.7
        ctx.beginPath()
        ctx.moveTo(b.x - 4, b.y)
        ctx.lineTo(b.x + 4, b.y)
        ctx.moveTo(b.x, b.y - 4)
        ctx.lineTo(b.x, b.y + 4)
        ctx.stroke()

        ctx.globalAlpha = fade * 0.6
        ctx.fillStyle = colour
        ctx.fillText(
          `ID ${String(b.id).padStart(2, '0')}  ${b.conf.toFixed(2)}`,
          b.x - bw,
          b.y - bh - 14
        )
      }

      // Association: link each track to a near neighbour.
      ctx.lineWidth = 1
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i]
          const b = blobs[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > 260) continue
          ctx.globalAlpha = (1 - d / 260) * 0.22
          ctx.strokeStyle = colour
          ctx.setLineDash([2, 4])
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      ctx.globalAlpha = 1
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
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
