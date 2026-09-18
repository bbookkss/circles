'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Phone navigation, at the bottom where a thumb is.
 *
 * Replaces the hamburger. Three lines in a corner is the least legible
 * control in mobile design: it says "there is more" and nothing about what,
 * so everything behind it costs a tap of pure guesswork. Every app a person
 * already uses puts its primary destinations on a bottom bar and leaves the
 * account in the top corner, and doing the same is worth more than being
 * different.
 *
 * Each target is the full height of the bar, which is 64px, comfortably past
 * both the WCAG 2.2 minimum of 24x24 and Apple's 44x44 guidance. Labels stay
 * under the icons rather than being dropped: an icon alone is a guess, and
 * these five are not all conventional enough to go unlabelled.
 *
 * Icons are inline SVG rather than an icon package, because five simple
 * shapes are not worth a dependency and these inherit currentColor, so the
 * active and inactive states come free from the text colour.
 */

const ICON = 'w-[22px] h-[22px]'

function Icon({ d, fill = false }: { d: string[]; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={ICON}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d.map((p, i) => (
        <path key={i} d={p} fill={fill && i === 0 ? 'currentColor' : 'none'} />
      ))}
    </svg>
  )
}

const ITEMS = [
  {
    href: '/home',
    label: 'Home',
    match: (p: string) => p === '/home',
    d: ['M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  },
  {
    href: '/explore',
    label: 'Explore',
    match: (p: string) => p === '/explore',
    d: ['M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  },
  {
    href: '/circles/new',
    label: 'New',
    match: (p: string) => p.startsWith('/circles/new'),
    d: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v8', 'M8 12h8'],
  },
  {
    href: '/messages',
    label: 'Messages',
    match: (p: string) => p.startsWith('/messages'),
    badge: 'dms' as const,
    d: ['M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.8-.8L3 21l1.9-5.1A8.2 8.2 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z'],
  },
  {
    href: '/notifications',
    label: 'Alerts',
    match: (p: string) => p === '/notifications',
    badge: 'notifs' as const,
    d: ['M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 7.5-2.5 7.5h17S18 15 18 8.5z', 'M13.7 20a2 2 0 0 1-3.4 0'],
  },
]

export default function BottomNav({ unread, unreadDms }: { unread: number; unreadDms: number }) {
  const pathname = usePathname() ?? ''
  const count = (b?: 'dms' | 'notifs') => (b === 'dms' ? unreadDms : b === 'notifs' ? unread : 0)

  return (
    <nav
      aria-label="Main"
      // pb from the safe area so the bar clears an iPhone's home indicator
      // instead of sitting under it.
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const active = item.match(pathname)
          const n = count(item.badge)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative h-16 flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-pen' : 'text-muted-foreground'
                }`}
              >
                <span className="relative">
                  <Icon d={item.d} />
                  {n > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-pen text-white text-[10px] font-semibold leading-4 text-center">
                      {n > 9 ? '9+' : n}
                    </span>
                  )}
                </span>
                <span className="text-[10px] leading-none font-medium">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
