import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The safety of both agents rests on one rule: every tool runs as the
 * visitor, so RLS decides what it can see. A tool that used the service-role
 * client would see everything. This test fails if any agent tool, or the
 * code that builds what the model reads, imports it.
 *
 * Only quota.ts may use the admin client, and only for its two RPCs.
 */

const ROOT = join(import.meta.dirname, '..', '..')
const GUARDED = [
  join(ROOT, 'lib', 'ai', 'tools'),
]
const FORBIDDEN = [
  /supabase\/admin/,
  /createAdminClient/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /SUPABASE_SECRET_KEY/,
  /['"]\.\.?\/quota['"]|ai\/quota/,
]

function files(dir: string): string[] {
  let out: string[] = []
  let names: string[] = []
  try { names = readdirSync(dir) } catch { return out }
  for (const n of names) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out = out.concat(files(p))
    else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts')) out.push(p)
  }
  return out
}

test('agent tools never touch the service-role client', () => {
  const found = GUARDED.flatMap(files)
  assert.ok(found.length > 0, 'expected tool files under src/lib/ai/tools')
  for (const f of found) {
    const src = readFileSync(f, 'utf8')
    for (const re of FORBIDDEN) assert.doesNotMatch(src, re, `${f} matches ${re}`)
  }
})

test('the admin client is used by quota.ts and nothing else in lib/ai', () => {
  for (const f of files(join(ROOT, 'lib', 'ai'))) {
    if (f.endsWith('quota.ts')) continue
    assert.doesNotMatch(readFileSync(f, 'utf8'), /createAdminClient|supabase\/admin/, f)
  }
})

test('tools know other people only by name, and never search for them', () => {
  // The assistant must be limited to what one person sees in the app. Other
  // people reach it only as names: attendees of the person's own meets and
  // senders of messages to them, both looked up by id. A tool that selected
  // more profile columns, or searched profiles by name, would be a people
  // lookup, which is exactly what it must not have.
  let lookups = 0
  for (const f of files(join(ROOT, 'lib', 'ai', 'tools'))) {
    const src = readFileSync(f, 'utf8')
    const re = /from\(['"]profiles['"]\)\s*\.select\(['"]([^'"]*)['"]\)\s*\.(\w+)\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      lookups++
      const cols = m[1].split(',').map((c) => c.trim())
      for (const c of cols) assert.ok(['id', 'full_name'].includes(c), `${f} selects profiles.${c}`)
      assert.ok(['in', 'eq'].includes(m[2]), `${f} filters profiles with .${m[2]}(), not by id`)
    }
    assert.doesNotMatch(src, /from\(['"]profiles['"]\)[\s\S]{0,200}\.(ilike|like|textSearch|or)\(/, `${f} searches profiles`)
  }
  // The meets, messages and suggestions tools each look names up once.
  assert.ok(lookups >= 3, `expected the name lookups to be found, saw ${lookups}`)
})
