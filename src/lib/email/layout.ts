/**
 * The shared frame for every email, in the app's design: paper ground, a white
 * card, ink text, one gold mark for "you can act on this now".
 *
 * Email is not the web. Gmail and Outlook strip <style> blocks, web fonts and
 * inline SVG, so everything here is inline styles on plain elements, the
 * typeface is a system stack that Host Grotesk would have resembled, and the
 * logo is the PNG the app already serves as its home-screen icon. Tables only
 * where a client would otherwise ignore centring or widths (Outlook).
 */

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hicircles.com'

const C = {
  paper: '#f7f8fa',
  card: '#ffffff',
  ink: '#1a2230',
  quiet: '#5c6878',
  rule: '#e3e7ed',
  cool: '#e2e9f1',
  heat: '#f2a531',
  heatInk: '#9a6200',
}
const FONT = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A big, light headline: the one thing the email says. */
export function headline(text: string): string {
  return `<p style="margin:0 0 10px;font-size:26px;line-height:1.15;font-weight:300;letter-spacing:-0.02em;color:${C.ink}">${escapeHtml(text)}</p>`
}

export function line(text: string, opts: { quiet?: boolean; size?: number } = {}): string {
  return `<p style="margin:0 0 8px;font-size:${opts.size ?? 15}px;line-height:1.5;color:${opts.quiet ? C.quiet : C.ink}">${escapeHtml(text)}</p>`
}

/** The heat mark: only for something the reader can act on now. */
export function heatNote(text: string): string {
  return `<p style="margin:14px 0 0;font-size:14px;font-weight:600;color:${C.heatInk}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${C.heat};margin-right:7px;vertical-align:1px"></span>${escapeHtml(text)}</p>`
}

/** An ink pill. One per email. */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px"><tr><td style="border-radius:999px;background:${C.ink}">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.paper};text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
  </td></tr></table>`
}

/** Quoted text written by a person (feedback, a report's details). */
export function quote(text: string): string {
  return `<div style="margin:16px 0 0;padding:14px 16px;border-radius:14px;background:${C.cool};font-size:15px;line-height:1.55;color:${C.ink};white-space:pre-wrap">${escapeHtml(text)}</div>`
}

/** Label / value rows for the internal emails. */
export function facts(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:${C.quiet};white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:${C.ink}">${escapeHtml(v)}</td></tr>`)
    .join('')}</table>`
}

export function layout(o: { preheader: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title></title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:28px 16px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
      <tr><td style="padding:0 4px 18px">
        <a href="${SITE}" style="text-decoration:none;color:${C.ink};font-size:17px;font-weight:600;letter-spacing:-0.01em">
          <img src="${SITE}/apple-icon" width="26" height="26" alt="" style="vertical-align:middle;border-radius:7px;margin-right:9px;border:0">Circles
        </a>
      </td></tr>
      <tr><td style="background:${C.card};border-radius:22px;padding:28px 28px 26px;border:1px solid ${C.rule}">
        ${o.body}
      </td></tr>
      <tr><td style="padding:18px 6px 0;font-size:13px;line-height:1.5;color:${C.quiet}">${o.footer}</td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

export function footerLink(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${C.quiet};text-decoration:underline">${escapeHtml(label)}</a>`
}
