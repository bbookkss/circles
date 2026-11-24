'use client'

import { useEffect } from 'react'
import { saveTheme } from '@/app/actions/settings'

/**
 * Light / dark.
 *
 * Before paint, the inline script in layout.tsx applies the choice kept on
 * this device ("circles-theme" in localStorage), or the device's own setting
 * if there is none. A tap flips it at once, keeps it on this device, and
 * saves it to the account (user_settings), so it follows the person to their
 * phone, the installed app and any other browser.
 *
 * `saved` is the account's choice, read by TopNav on the server. When it
 * differs from what this device has, the account wins: that's how a choice
 * made on the laptop reaches the phone. With nothing chosen anywhere, the
 * theme follows the device live, so switching the phone to dark at sunset
 * switches Circles too.
 */
const KEY = 'circles-theme'
const SYNCED = 'circles-theme-synced'

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export default function ThemeToggle({ className = '', saved = null }: { className?: string; saved?: 'light' | 'dark' | null }) {

  useEffect(() => {
    let local: string | null = null
    try { local = localStorage.getItem(KEY) } catch {}
    // Once per visit: after that, `saved` can be a stale server render from
    // before a tap, and obeying it would undo the tap.
    let synced = false
    try { synced = sessionStorage.getItem(SYNCED) === '1'; sessionStorage.setItem(SYNCED, '1') } catch {}
    if (!synced && saved && saved !== local) {
      try { localStorage.setItem(KEY, saved) } catch {}
      apply(saved === 'dark')
      local = saved
    }
    if (local) return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => apply(mq.matches)
    follow()
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [saved])

  function flip() {
    const next = !document.documentElement.classList.contains('dark')
    apply(next)
    try { localStorage.setItem(KEY, next ? 'dark' : 'light'); sessionStorage.setItem(SYNCED, '1') } catch {}
    // After the change is on screen; a failure here only means the next
    // device won't know, never that this one doesn't switch.
    saveTheme(next ? 'dark' : 'light').catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={flip}
      // The class on <html> is the state; nothing here needs a copy of it.
      aria-label="Switch between light and dark mode"
      className={`w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      {/* Both icons render; CSS picks one, so there's no wrong-icon flash before hydration. */}
      <svg className="dark:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="hidden dark:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  )
}
