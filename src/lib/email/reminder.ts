import { tzAbbrev } from '@/lib/schedule'
import { layout, headline, line, heatNote, button, footerLink, escapeHtml } from '@/lib/email/layout'

/**
 * The reminder email itself.
 *
 * Kept away from the route so the wording can be read and changed without
 * scrolling past delivery plumbing, and so it can be rendered in a test
 * without sending anything.
 *
 * Plain text is generated alongside the HTML rather than left to the provider
 * to synthesise. Some clients show the text part, and an auto-stripped
 * version of marketing HTML reads like debris.
 */

export type ReminderInput = {
  circleName: string
  fullName: string | null
  kind: '24h' | '3h'
  startsAt: string
  timezone: string
  where: string | null
  unsubscribeUrl: string
  circleUrl: string
}

function when(startsAt: string, timezone: string, kind: '24h' | '3h'): string {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(startsAt))
    .toLowerCase()
    .replace(':00', '')
    .replace(' ', '')

  // The zone is always named here. A reminder is read on a phone in whatever
  // city the person woke up in, and unlike the app we cannot know which.
  const zone = tzAbbrev(timezone, new Date(startsAt))
  return kind === '24h' ? `tomorrow at ${time} ${zone}` : `at ${time} ${zone}`
}

export function reminderSubject(i: ReminderInput): string {
  return i.kind === '24h'
    ? `${i.circleName} tomorrow`
    : `${i.circleName} in a few hours`
}

export function reminderText(i: ReminderInput): string {
  const first = i.fullName?.split(' ')[0]
  return [
    first ? `Hey ${first},` : 'Hey,',
    '',
    `${i.circleName} meets ${when(i.startsAt, i.timezone, i.kind)}.`,
    i.where ? i.where : null,
    '',
    "Check-in is open. Say if you're coming:",
    i.circleUrl,
    '',
    `Stop these emails: ${i.unsubscribeUrl}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export function reminderHtml(i: ReminderInput): string {
  const first = i.fullName?.split(' ')[0]
  const whenText = when(i.startsAt, i.timezone, i.kind)
  // Both reminders land inside the check-in window (it opens 24 hours before),
  // so the gold "act now" mark is true for both.
  return layout({
    preheader: `${i.circleName} meets ${whenText}. Check-in is open.`,
    body: [
      first ? line(`Hi ${first},`, { quiet: true, size: 14 }) : '',
      headline(`${i.circleName} meets ${whenText}.`),
      i.where ? line(i.where, { quiet: true }) : '',
      heatNote("Check-in is open. Say if you're coming."),
      button("See who's coming", i.circleUrl),
    ].join('\n'),
    footer: `You get these because you're in ${escapeHtml(i.circleName)}. ${footerLink('Stop these emails', i.unsubscribeUrl)}`,
  })
}
