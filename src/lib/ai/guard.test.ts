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
