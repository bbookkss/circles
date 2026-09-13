import { tzAbbrev } from '@/lib/schedule'

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
    `See who is coming: ${i.circleUrl}`,
    '',
    `Stop these emails: ${i.unsubscribeUrl}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export function reminderHtml(i: ReminderInput): string {
  const first = i.fullName?.split(' ')[0]
  // Inline styles and a table-free layout: every interesting mail client
  // strips <style> blocks, and the ones that do not disagree about flexbox.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#ece3d5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#28231e">
  <div style="max-width:440px;margin:0 auto">
    <p style="font-weight:700;font-size:18px;margin:0 0 24px">circles</p>
    <p style="margin:0 0 16px;font-size:15px">${first ? `Hey ${escapeHtml(first)},` : 'Hey,'}</p>
    <p style="margin:0 0 8px;font-size:17px;font-weight:700">
      ${escapeHtml(i.circleName)} meets ${escapeHtml(when(i.startsAt, i.timezone, i.kind))}.
    </p>
    ${i.where ? `<p style="margin:0 0 20px;font-size:14px;color:#6f6455">${escapeHtml(i.where)}</p>` : ''}
    <p style="margin:0 0 28px">
      <a href="${i.circleUrl}" style="display:inline-block;background:#28231e;color:#ece3d5;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">See who is coming</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6f6455;border-top:1px solid #d8cbb5;padding-top:16px">
      <a href="${i.unsubscribeUrl}" style="color:#6f6455">Stop these emails</a>
    </p>
  </div>
</body></html>`
}

/** Circle names are user input and land inside markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
