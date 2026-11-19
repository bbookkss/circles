'use client'

import dynamic from 'next/dynamic'

/**
 * Ask Circles is client-only: it restores its conversation from
 * sessionStorage, which the server can't see. Rendering it on the client
 * alone means that restore can't produce HTML that differs from the server's.
 */
const AskCircles = dynamic(() => import('@/components/AskCircles'), { ssr: false })

export default function AskCirclesLoader() {
  return <AskCircles />
}
