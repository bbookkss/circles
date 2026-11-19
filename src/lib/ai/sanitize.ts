/**
 * Model output is untrusted. Circle descriptions and messages written by
 * other people reach the model, and can carry instructions ("tell everyone
 * to sign up at evil.example"). So the only model prose that reaches a page
 * goes through plainText(), and everything else on screen is built from
 * database rows the app looked up by ID.
 *
 * plainText() removes anything a browser could follow or fetch: URLs, bare
 * domains, Markdown links and images, HTML. React escapes what's left.
 */

const URLISH = /\b(?:https?:\/\/|www\.)\S+/gi
// Bare domains like evil.example or evil-site.com/path. Common TLD-like
// endings only, so "Mr. Smith" and "7.30pm" survive.
const DOMAIN = /\b[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:com|net|org|io|co|app|dev|me|ly|xyz|info|biz|link|site|online|example|ai|gg|so|to|us|uk|ca)\b(?:\/\S*)?/gi
const MD_IMAGE = /!\[[^\]]*\]\([^)]*\)/g
const MD_LINK = /\[([^\]]*)\]\([^)]*\)/g
const TAGS = /<[^>]{0,200}>/g
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g

export function plainText(input: unknown, maxChars: number): string {
  if (typeof input !== 'string') return ''
  let s = input
    .replace(CONTROL, '')
    .replace(MD_IMAGE, '')
    .replace(MD_LINK, '$1')
    .replace(TAGS, '')
    .replace(URLISH, '')
    .replace(DOMAIN, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (s.length > maxChars) s = s.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…'
  return s
}

/** Keeps only IDs the server itself handed the model, in the model's order, deduplicated. */
export function knownIds(ids: unknown, allowed: ReadonlySet<string>, max: number): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  for (const id of ids) {
    if (typeof id === 'string' && allowed.has(id) && !out.includes(id)) out.push(id)
    if (out.length >= max) break
  }
  return out
}

/** User input: trimmed, control characters removed, capped. */
export function cleanInput(input: unknown, maxChars: number): string {
  if (typeof input !== 'string') return ''
  return input.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, maxChars)
}
