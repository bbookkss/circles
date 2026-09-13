import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailConfigured, sendEmail } from '@/lib/email/send'
import { reminderSubject, reminderText, reminderHtml } from '@/lib/email/reminder'

/**
 * The endpoint pg_cron calls to send meet reminders.
 *
 * Runs on a schedule rather than on a request, so it authenticates with a
 * shared secret instead of a session. Without CRON_SECRET set it refuses
 * everything: an open endpoint that reads every member's address and can
 * trigger mail is not something to leave ajar while the feature is half
 * built.
 *
 * Two modes, decided by whether a mail provider is configured.
 *
 *   dry run   No provider. Reports what it would send and claims nothing.
 *             This is the honest state before Resend exists: claiming rows
 *             without delivering would mark reminders sent that nobody ever
 *             received, and the send log is append-only in practice.
 *
 *   live      Provider present. Claims each row first, then sends. That order
 *             is deliberate. A crash between the two loses one reminder; the
 *             other order mails somebody four times when a run is retried,
 *             and there is no undo for that.
 */

export const dynamic = 'force-dynamic'

type DueRow = {
  circle_id: string
  circle_name: string
  timezone: string | null
  place: string | null
  user_id: string
  email: string
  full_name: string | null
  occurs_on: string
  kind: '24h' | '3h'
  starts_at: string
  unsubscribe_token: string
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured; refusing to run' },
      { status: 503 }
    )
  }
  // Compared against a header rather than a query string so the secret stays
  // out of logs and referrers.
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('due_email_reminders')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const due = (data ?? []) as DueRow[]
  const hasProvider = emailConfigured()

  if (!hasProvider) {
    return NextResponse.json({
      mode: 'dry-run',
      reason: 'RESEND_API_KEY is not set, so nothing was sent and nothing was claimed',
      due: due.length,
      breakdown: due.reduce<Record<string, number>>((acc, r) => {
        acc[r.kind] = (acc[r.kind] ?? 0) + 1
        return acc
      }, {}),
    })
  }

  // Live path. Claim first: the insert fails on the primary key if another
  // run got there first, which is what makes concurrent runs safe rather than
  // merely unlikely.
  let sent = 0
  let skipped = 0
  const failures: string[] = []

  for (const row of due) {
    const { error: claimError } = await admin.from('email_reminder_sends').insert({
      circle_id: row.circle_id,
      user_id: row.user_id,
      occurs_on: row.occurs_on,
      kind: row.kind,
    })
    // 23505 is the primary key: somebody else already claimed this one.
    if (claimError) {
      if (claimError.code === '23505') skipped++
      else failures.push(`${row.circle_name}: ${claimError.message}`)
      continue
    }

    try {
      await sendReminder(row)
      sent++
    } catch (e) {
      // The claim stands. Better one missed reminder than a retry loop that
      // mails the same person on every pass.
      failures.push(`${row.circle_name}: ${e instanceof Error ? e.message : 'send failed'}`)
    }
  }

  return NextResponse.json({ mode: 'live', due: due.length, sent, skipped, failures })
}

async function sendReminder(row: DueRow): Promise<void> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hicircles.com'
  const unsubscribeUrl = `${site}/api/unsubscribe?token=${row.unsubscribe_token}`

  const input = {
    circleName: row.circle_name,
    fullName: row.full_name,
    kind: row.kind,
    startsAt: row.starts_at,
    // The resolver already computed starts_at in the circle's zone; this is
    // only used to name the zone in the copy.
    timezone: row.timezone ?? 'America/Los_Angeles',
    where: row.place ?? null,
    unsubscribeUrl,
    circleUrl: `${site}/circles/${row.circle_id}`,
  }

  await sendEmail({
    to: row.email,
    subject: reminderSubject(input),
    html: reminderHtml(input),
    text: reminderText(input),
    unsubscribeUrl,
  })
}
