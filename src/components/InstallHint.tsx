'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * iPhone Safari never offers to install a web app, so say how, once.
 * Shown only in Safari on iOS, only when not already opened from the home
 * screen, never on the landing or sign-in pages, and never again after it's
 * dismissed (kept in localStorage; if storage fails it just shows again).
 */
const KEY = 'circles-install-hint'
const HIDDEN_ON = ['/', '/login', '/signup', '/check-email', '/forgot-password']

export default function InstallHint() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    // Chrome, Firefox and others on iOS say CriOS/FxiOS/EdgiOS; only Safari's Share sheet has the option.
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissed = false
    try { dismissed = localStorage.getItem(KEY) === 'dismissed' } catch {}
    const t = setTimeout(() => setShow(ios && safari && !standalone && !dismissed), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!show || HIDDEN_ON.includes(pathname)) return null

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(KEY, 'dismissed') } catch {}
  }

  return (
    <div
      role="note"
      className="md:hidden fixed z-40 left-3 right-3 top-[calc(4rem+env(safe-area-inset-top))] glass rounded-2xl pl-3.5 pr-2 py-2.5 flex items-start gap-2.5 text-sm"
    >
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </svg>
      <p className="flex-1 leading-snug">
        <span className="font-medium">Add Circles to your Home Screen.</span>{' '}
        <span className="text-muted-foreground">Tap Share, then Add to Home Screen.</span>
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  )
}
