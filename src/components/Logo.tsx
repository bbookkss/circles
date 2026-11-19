'use client'

import { useEffect, useRef } from 'react'

/**
 * The Circles mark: a dot inside a ring of five dashes that turns slowly
 * (globals.css, .logo-ring).
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

export default function Logo({ size = 20, className = '', busy = false }: { size?: number; className?: string; busy?: boolean }) {
  const ringRef = useRef<SVGCircleElement>(null)
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
      <circle
        ref={ringRef}
        className="logo-ring"
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={50}
        strokeDasharray="6.4 3.6"
      />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}
