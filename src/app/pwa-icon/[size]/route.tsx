import { appIcon } from '@/lib/appIcon'

/** App icons for the web app manifest: /pwa-icon/192 and /pwa-icon/512. */
const SIZES = new Set([192, 512])

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const px = Number((await ctx.params).size)
  if (!SIZES.has(px)) return new Response('Not found', { status: 404 })
  const res = appIcon(px)
  res.headers.set('Cache-Control', 'public, max-age=86400, immutable')
  return res
}
