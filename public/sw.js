/*
 * Circles service worker. Only notifications: no offline caching, no fetch
 * handler, so the site behaves exactly as it does without it.
 *
 * A push carries { title, body, url, tag }, built on the server. Tapping
 * opens url (always a path on this site), reusing an open Circles window.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const url = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/home'
  event.waitUntil(
    self.registration.showNotification(String(data.title || 'Circles'), {
      body: String(data.body || ''),
      icon: '/pwa-icon/192',
      badge: '/pwa-icon/192',
      tag: data.tag || undefined,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/home', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('navigate' in w && w.url.startsWith(self.location.origin)) {
          return w.focus().then(() => w.navigate(url))
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
