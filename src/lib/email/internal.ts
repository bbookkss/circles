import { layout, headline, line, quote, facts, button, SITE } from '@/lib/email/layout'

/**
 * Emails that only go to the people running Circles: feedback from the
 * in-app button, and new reports. Same frame as the member emails, so they
 * read as part of the product rather than a log dump.
 *
 * Everything a member wrote goes through quote(), which escapes it.
 */

export function feedbackHtml(o: { name: string; email: string; page: string | null; message: string }): string {
  return layout({
    preheader: `${o.name}: ${o.message.slice(0, 90)}`,
    body: [
      headline(`Feedback from ${o.name}`),
      line('Reply to this email to answer them directly.', { quiet: true, size: 14 }),
      quote(o.message),
      facts([
        ['From', `${o.name} <${o.email}>`],
        ...(o.page ? [['Page', o.page] as [string, string]] : []),
      ]),
    ].join('\n'),
    footer: 'Sent from the Feedback button in Circles.',
  })
}

export function reportHtml(o: { targetType: string; label: string; details: string | null; reportId: string | null }): string {
  return layout({
    preheader: `A ${o.targetType} was reported: ${o.label}.`,
    body: [
      headline(`A ${o.targetType} was reported`),
      line(`Reason: ${o.label}.`),
      o.details ? quote(o.details) : '',
      button('Review in Admin', `${SITE}/admin`),
      o.reportId ? line(`Report ${o.reportId}`, { quiet: true, size: 13 }) : '',
    ].join('\n'),
    footer: 'Reports also appear in Admin, with a snapshot of what was reported.',
  })
}
