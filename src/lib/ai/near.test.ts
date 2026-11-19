import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNear } from './near.ts'

test('rounds to about a kilometre', () => {
  assert.deepEqual(parseNear({ lat: 37.774929, lng: -122.419416 }), { latitude: 37.77, longitude: -122.42, city: null })
})

test('ignores anything that is not a real position', () => {
  for (const bad of [null, 'here', {}, { lat: '37', lng: '-122' }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: Infinity, lng: 0 }]) {
    assert.equal(parseNear(bad), null)
  }
})
