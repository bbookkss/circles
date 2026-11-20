import { test } from 'node:test'
import assert from 'node:assert/strict'
import { costOk, meetsOn, parseQuery, scoreText } from './match.ts'

test('days, weekend and cost become filters, not words', () => {
  const p = parseQuery('anything free this weekend')
  assert.deepEqual(p.terms, [])
  assert.deepEqual(p.days, [0, 6])
  assert.equal(p.free, true)
  assert.deepEqual(parseQuery('hoops on saturday').days, [6])
})

test('synonyms and plurals reach the same activity', () => {
  const run = { name: 'Marina Run Club', category: 'Sports' }
  for (const q of ['running', 'runners', 'jogging', 'run']) assert.ok(scoreText(run, parseQuery(q)) > 0, q)
  assert.ok(scoreText({ name: 'Sunday pickup basketball' }, parseQuery('hoops')) > 0)
  assert.ok(scoreText({ name: 'Lindy in the Park' }, parseQuery('dance classes')) > 0)
  assert.equal(scoreText({ name: 'Thursday Chess' }, parseQuery('basketball')), 0)
})

test('matching is by word start, so "art" does not hit "party"', () => {
  assert.equal(scoreText({ name: 'Rooftop party' }, parseQuery('art')), 0)
  assert.ok(scoreText({ name: 'Art walk' }, parseQuery('art')) > 0)
})

test('name hits outrank description hits', () => {
  const q = parseQuery('chess')
  assert.ok(scoreText({ name: 'Thursday Chess' }, q) > scoreText({ name: 'Games night', description: 'chess and more' }, q))
})

test('filters', () => {
  assert.ok(meetsOn([2, 6], [6]))
  assert.ok(!meetsOn([2], [0, 6]))
  assert.ok(meetsOn([], null))
  assert.ok(costOk(null, true))
  assert.ok(!costOk(false, true))
  assert.ok(costOk(false, false))
})
