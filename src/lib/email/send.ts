import 'server-only'

/**
 * Resend, called over HTTP rather than through their SDK.
 *
 * One POST to one endpoint does not justify a dependency, and the fetch is
 * easier to read than the wrapper would be.
 *
 * Mail is sent from a subdomain, which is not cosmetic. hicircles.com already
 * has an SPF record pointing at Google Workspace, and a domain may have
 * exactly one: adding a second TXT for a new sender invalidates both and
 * breaks every existing sender at once. send.hicircles.com gets its own
 * record and the root is never touched.
 */

const ENDPOINT = 'https://api.resend.com/emails'

export type SendArgs = {
  to: string
  subject: string
  html: string
  text: string
  /** Used for the List-Unsubscribe headers, not just the body link. */
  unsubscribeUrl: string
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(args: SendArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')

  const from = process.env.EMAIL_FROM ?? 'Circles <reminders@send.hicircles.com>'
  // Replies should reach a mailbox a person reads, not the sending subdomain,
  // which has no inbox behind it.
  const replyTo = process.env.EMAIL_REPLY_TO ?? 'info@hicircles.com'

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      reply_to: replyTo,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers: {
        // Gmail and Yahoo require these of anyone sending at volume, and they
        // put an Unsubscribe button in the client's own chrome. One-Click
        // means the client POSTs rather than opening the link, which is why
        // /api/unsubscribe exists separately from the confirmation page.
        'List-Unsubscribe': `<${args.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`resend ${res.status}: ${body.slice(0, 200)}`)
  }
}
