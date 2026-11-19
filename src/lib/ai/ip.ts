/**
 * Who is asking, for rate limiting signed-out visitors.
 *
 * On Vercel, `x-real-ip` is set by the platform from the connection, and a
 * client cannot override it. The first entry of `x-forwarded-for` is whatever
 * the client sent, so it is never trusted. Outside Vercel (local dev) there
 * is no trustworthy header, and everyone shares one bucket.
 *
 * IPv6 is bucketed by /64. A home connection usually gets a whole /64, so
 * counting single addresses would let one person rotate through 2^64 of them.
 */

export function clientIp(get: (name: string) => string | null, onVercel: boolean): string {
  if (!onVercel) return 'local'
  const ip = get('x-real-ip')?.trim()
  return ip && ip.length <= 64 ? ip : 'unknown'
}

export function ipBucket(ip: string): string {
  if (!ip.includes(':')) return ip
  // Expand "::" so the first four groups are real groups, then keep them.
  const [head, tail = ''] = ip.toLowerCase().split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64'
}
