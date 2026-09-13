import { NextResponse } from 'next/server'
import { unsubscribeByToken } from '@/app/actions/email'

/**
 * One-click unsubscribe, for the List-Unsubscribe-Post header.
 *
 * Gmail and Yahoo show an Unsubscribe button in their own chrome and, when a
 * message carries that header, POST here directly rather than opening the
 * page. The person never sees our confirmation screen, so this acts
 * immediately. That is the whole point of the header: one press, done.
 *
 * Separate from the page for exactly that reason. The page confirms because a
 * GET can be triggered by a link scanner; this cannot, because scanners do
 * not POST.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const token =
    new URL(request.url).searchParams.get('token') ??
    // RFC 8058 says the body is List-Unsubscribe=One-Click; some clients send
    // the token in the query string instead. Accept both.
    (await request.text().then((t) => new URLSearchParams(t).get('token')).catch(() => null))

  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 })

  const result = await unsubscribeByToken(token)
  // A bad token still returns 200. A mail client showing "unsubscribe failed"
  // helps nobody, and the only caller is a machine following a header we
  // ourselves wrote.
  return NextResponse.json({ ok: result.ok })
}
