'use client'

import { useEffect, useRef } from 'react'

/**
 * The Circles mark: five people gathered round a dot, each a head and a pair
 * of shoulders facing the middle, the way a circle sits round a table. It
 * grew out of a ring of five dashes; the dashes became the shoulders. The
 * people turn slowly together (globals.css, .logo-ring).
 *
 * Point at it, or at the link or button it sits in, and it speeds up; press
 * and it goes faster again; let go and it coasts back down. `busy` spins it
 * fast while something is working, as Radius does.
 *
 * The speed is changed with the Web Animations playbackRate rather than by
 * swapping animation-duration: a new duration restarts the maths and the ring
 * jumps, while a rate eased frame by frame reads as a real wheel spinning up.
 * Under reduced motion there is no animation, so none of this runs.
 */

const RATE = { idle: 1, hover: 3, press: 6, busy: 8 }

// Five people at 72° apart, the first at the top. Shoulders are 40° arcs on a
// radius-7.9 ring; heads sit at radius 5. Precomputed (see the commit that
// introduced them) so the server and client render identical markup.
const SHOULDERS =
  'M7.298 2.576A7.9 7.9 0 0 1 12.702 2.576' +
  'M16.225 5.136A7.9 7.9 0 0 1 17.895 10.276' +
  'M16.549 14.418A7.9 7.9 0 0 1 12.178 17.594' +
  'M7.822 17.594A7.9 7.9 0 0 1 3.451 14.418' +
  'M2.105 10.276A7.9 7.9 0 0 1 3.775 5.136'
const HEADS: [number, number][] = [
  [10, 5], [14.755, 8.455], [12.939, 14.045], [7.061, 14.045], [5.245, 8.455],
]

export default function Logo({ size = 20, className = '', busy = false }: { size?: number; className?: string; busy?: boolean }) {
  const ringRef = useRef<SVGGElement>(null)
  const busyRef = useRef(busy)
  const target = useRef(busy ? RATE.busy : RATE.idle)
  const kick = useRef<() => void>(() => {})

  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    const anim = () => ring.getAnimations?.()[0]
    let frame = 0
    let hover = false
    let press = false

    const step = () => {
      const a = anim()
      if (!a) return
      const cur = a.playbackRate
      const next = cur + (target.current - cur) * 0.08 // ease toward the target
      if (Math.abs(next - target.current) < 0.01) {
        a.playbackRate = target.current
        frame = 0
        return
      }
      a.playbackRate = next
      frame = requestAnimationFrame(step)
    }
    const retarget = () => {
      target.current = busyRef.current ? RATE.busy : press ? RATE.press : hover ? RATE.hover : RATE.idle
      if (!frame) frame = requestAnimationFrame(step)
    }
    kick.current = retarget

    // The thing you'd point at: the link or button around the mark, else the mark.
    const host = (ring.closest('a, button, [data-logo-host]') as HTMLElement | null) ?? ring.ownerSVGElement
    if (!host) return
    const enter = () => { hover = true; retarget() }
    const leave = () => { hover = false; press = false; retarget() }
    const down = () => { press = true; retarget() }
    const up = () => { press = false; retarget() }
    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointerleave', leave)
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointerup', up)
    host.addEventListener('focus', enter)
    host.addEventListener('blur', leave)
    retarget()
    return () => {
      cancelAnimationFrame(frame)
      host.removeEventListener('pointerenter', enter)
      host.removeEventListener('pointerleave', leave)
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('focus', enter)
      host.removeEventListener('blur', leave)
    }
  }, [])

  useEffect(() => {
    busyRef.current = busy
    kick.current()
  }, [busy])

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className={`block overflow-visible ${className}`}>
      <g ref={ringRef} className="logo-ring" fill="currentColor">
        {/* Shoulders: five arcs on the ring. Heads: just inside each, facing in. */}
        <path
          d={SHOULDERS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {HEADS.map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r="1.15" />
        ))}
      </g>
      <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    </svg>
  )
}
