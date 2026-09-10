'use client'

import { useEffect, useRef } from 'react'

/**
 * CRT.
 *
 * A phosphor tube does four things a flat panel does not: it draws in
 * scanlines with gaps between them, the beam blooms so bright areas bleed into
 * the dark, the colour guns are very slightly out of convergence, and the
 * vertical hold drifts so a faint band rolls down the screen. All four are
 * here; none of them is the picture, they are what the picture is shown on.
 *
 * The picture itself is the same expanding rings as the current hero, so the
 * comparison is about treatment rather than subject.
 */

type Ring = { x: number; y: number; born: number }

export default function CrtField({ tint = '#8ce6b0' }: { tint?: string }) {
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

    let rings: Ring[] = []
    let t = 0
    let next = 0
    let raf = 0
    let last = 0

    const LIFE = 4.5
    const SPEED = 90

    const drawRings = (offsetX: number, colour: string, alpha: number) => {
      ctx.strokeStyle = colour
      for (const r of rings) {
        const age = t - r.born
        const fade = 1 - age / LIFE
        if (fade <= 0) continue
        // Three crests per drop, so it reads as a wave packet, not a hoop.
        for (let k = 0; k < 3; k++) {
          const rad = (age - k * 0.16) * SPEED
          if (rad <= 0) continue
          ctx.globalAlpha = alpha * fade * (1 - k * 0.28)
          ctx.lineWidth = 1.4 - k * 0.3
          ctx.beginPath()
          ctx.ellipse(r.x + offsetX, r.y, rad, rad * 0.55, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
      last = now
      t += dt

      if (t > next) {
        next = t + 0.35 + Math.random() * 0.7
        rings.push({ x: Math.random() * w, y: Math.random() * h, born: t })
        if (rings.length > 14) rings.shift()
      }
      rings = rings.filter((r) => t - r.born < LIFE)

      ctx.clearRect(0, 0, w, h)

      // Bloom: the same rings drawn fat and soft underneath the sharp pass.
      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = 'blur(6px)'
      drawRings(0, tint, 0.5)
      ctx.filter = 'none'

      // Convergence error. The guns never line up perfectly.
      drawRings(-0.9, '#ff5a5a', 0.16)
      drawRings(0.9, '#5ac8ff', 0.16)
      drawRings(0, tint, 0.75)
      ctx.globalCompositeOperation = 'source-over'

      // Scanlines: the gaps between beam passes, not lines drawn on top.
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1.5)

      // Vertical hold drifting: a soft band working its way down.
      const bandY = ((t * 60) % (h + 220)) - 110
      const band = ctx.createLinearGradient(0, bandY - 110, 0, bandY + 110)
      band.addColorStop(0, 'rgba(255,255,255,0)')
      band.addColorStop(0.5, 'rgba(255,255,255,0.045)')
      band.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = band
      ctx.fillRect(0, bandY - 110, w, 220)

      // Vignette. Tube corners are always darker.
      const vig = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.25,
        w / 2, h / 2, Math.max(w, h) * 0.72
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [tint])

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
