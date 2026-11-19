'use client'

import { useEffect, useRef } from 'react'

/**
 * A drawn neighbourhood: cool streets, parks and water, with circles shown as
 * patches of heat. Decorative. It is not a real map and carries no real
 * coordinates; x/y are fractions of the canvas.
 *
 *   areas   heat patches. temp 0..1, hotter = sooner or more active.
 *           Each settles in on load, then breathes slowly (8s).
 *   exact   exact pins, for circles the viewer is a member of. Never pass
 *           these to a signed-out page.
 *   seed    changes the street layout.
 *
 * Theme-aware: it reads --cool, --cool-2, --heat, --background and
 * --foreground from the document, and redraws when the .dark class flips.
 * Still under prefers-reduced-motion. The animation loop stops on unmount.
 */

export type HeatArea = { x: number; y: number; r: number; temp: number }
export type HeatPin = { x: number; y: number }

type Props = {
  areas: HeatArea[]
  exact?: HeatPin[]
  seed?: number
  className?: string
  label?: string
}

function rng(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

function rgba(color: string, a: number) {
  const hex = color.trim().replace('#', '')
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex, 16)
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
  }
  return `rgba(242,165,49,${a})`
}

export default function HeatMap({ areas, exact = [], seed = 7, className = '', label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Read on every frame so a parent can change them without restarting.
  const data = useRef({ areas, exact, seed })
  useEffect(() => {
    data.current = { areas, exact, seed }
  }, [areas, exact, seed])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let start: number | null = null
    let raf = 0
    let alive = true

    function paint(now: number) {
      if (!canvas) return
      const root = document.documentElement
      const css = getComputedStyle(root)
      const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f
      const dark = root.classList.contains('dark')
      const land = v('--cool', '#e2e9f1')
      const park = v('--cool-2', '#cfdbe8')
      const heat = v('--heat', '#f2a531')
      const street = dark ? '#414b58' : '#f4f7fa'
      const water = dark ? '#2c3d50' : '#c6d6e6'
      const paper = v('--background', '#f7f8fa')
      const ink = v('--foreground', '#1a2230')

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = land
      g.fillRect(0, 0, w, h)

      const { areas, exact, seed } = data.current
      const r = rng(seed || 7)
      const span = Math.max(w, h) * 1.1
      g.save()
      g.translate(w / 2, h * 0.42)
      g.rotate(-0.16)
      g.fillStyle = water
      g.beginPath()
      g.moveTo(span * 0.42, -span)
      g.bezierCurveTo(span * 0.3, -60, span * 0.5, 80, span * 0.36, span)
      g.lineTo(span, span)
      g.lineTo(span, -span)
      g.fill()
      g.fillStyle = park
      for (const [x, y, pw, ph] of [[-150, -40, 150, 96], [210, 60, 92, 120], [-520, 70, 120, 80]]) {
        g.beginPath()
        g.roundRect(x, y, pw, ph, 6)
        g.fill()
      }
      g.strokeStyle = street
      g.lineCap = 'round'
      for (let x = -span; x < span; x += 46) {
        if (r() < 0.12) continue
        g.lineWidth = r() < 0.18 ? 7 : 3.5
        g.beginPath(); g.moveTo(x, -span); g.lineTo(x, span); g.stroke()
      }
      for (let y = -span; y < span; y += 38) {
        if (r() < 0.12) continue
        g.lineWidth = r() < 0.18 ? 7 : 3.5
        g.beginPath(); g.moveTo(-span, y); g.lineTo(span, y); g.stroke()
      }
      g.lineWidth = 10
      g.beginPath(); g.moveTo(-span, span * 0.35); g.lineTo(span, -span * 0.5); g.stroke()
      g.restore()

      if (start === null) start = now
      const t = (now - start) / 1000
      areas.forEach((a, i) => {
        const p = reduce ? 1 : Math.max(0, Math.min(1, (t / 1.1) * 1.6 - i * 0.25))
        const e = 1 - Math.pow(1 - p, 3)
        const breath = reduce ? 1 : 1 + 0.18 * a.temp * Math.sin((t * 2 * Math.PI) / 8 + i * 1.3)
        const x = a.x * w
        const y = a.y * h
        const rad = a.r * (0.96 + 0.04 * breath)
        const k = a.temp * e * breath
        const grad = g.createRadialGradient(x, y, 0, x, y, rad)
        grad.addColorStop(0, rgba(heat, Math.min(1, 0.75 * k)))
        grad.addColorStop(0.45, rgba(heat, Math.min(1, 0.32 * k)))
        grad.addColorStop(1, rgba(heat, 0))
        g.fillStyle = grad
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
      })
      for (const pt of exact) {
        const x = pt.x * w
        const y = pt.y * h
        g.fillStyle = paper
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill()
        g.fillStyle = ink
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill()
      }
    }

    function loop(now: number) {
      if (!alive) return
      paint(now)
      if (!reduce) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const redraw = () => paint(performance.now())
    window.addEventListener('resize', redraw)
    // Theme flips (the .dark class) and system changes.
    const obs = new MutationObserver(redraw)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', redraw)
      obs.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className={`block w-full h-full ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
