'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

type Props = {
  unread: number
  unreadDms: number
}

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/circles/new', label: '+ New Circle' },
  { href: '/messages', label: 'Messages', badge: 'dms' as const },
  { href: '/notifications', label: 'Notifications', badge: 'notifs' as const },
  { href: '/profile', label: 'Your profile' },
]

/**
 * Phone navigation.
 *
 * The bar packs eight items into a fixed row, which fits a laptop and not a
 * 390px screen: everything from Messages rightwards was simply off-screen, so
 * on a phone there was no way to reach your messages or even sign out.
 */
export default function MobileNav({ unread, unreadDms }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const hasUnread = unread + unreadDms > 0

  const count = (b?: 'dms' | 'notifs') =>
    b === 'dms' ? unreadDms : b === 'notifs' ? unread : 0

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full border border-input flex items-center justify-center hover:bg-muted transition-colors"
      >
        <span className="flex flex-col gap-[3px]" aria-hidden>
          <span className={`block w-4 h-px bg-foreground transition-transform ${open ? 'translate-y-[4px] rotate-45' : ''}`} />
          <span className={`block w-4 h-px bg-foreground transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-4 h-px bg-foreground transition-transform ${open ? '-translate-y-[4px] -rotate-45' : ''}`} />
        </span>
        {/* An unread count is useless behind a closed menu, so surface it. */}
        {hasUnread && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-foreground border-2 border-background" />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-foreground/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav className="fixed left-0 right-0 top-14 z-50 bg-background border-b shadow-lg">
            <ul className="py-1">
              {LINKS.map((l) => {
                const n = count(l.badge)
                const active = pathname === l.href
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between px-5 py-3 text-sm transition-colors ${
                        active ? 'font-semibold text-foreground bg-muted' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{l.label}</span>
                      {n > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center">
                          {n > 9 ? '9+' : n}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
              <li className="border-t mt-1 pt-1">
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full text-left px-5 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </>
      )}
    </div>
  )
}
