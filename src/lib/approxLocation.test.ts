import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approxArea, BLUR_RADIUS_M } from './approxLocation.ts'

/** Great-circle distance in metres. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_378_137
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const SF = { lat: 37.8099, lng: -122.4783 }

test('the meeting point is inside the area shown', () => {
  for (let i = 0; i < 200; i++) {
    const a = approxArea(SF.lat, SF.lng, `circle-${i}`)
    const d = metresBetween(SF.lat, SF.lng, a.latitude, a.longitude)
    assert.ok(
      d < a.radiusM,
      `seed ${i}: point is ${d.toFixed(0)}m from centre, outside the ${a.radiusM}m area`
    )
  }
})

test('the area is not centred on the meeting point', () => {
  // The whole design: a centred blur would announce the answer in the middle.
  for (let i = 0; i < 200; i++) {
    const a = approxArea(SF.lat, SF.lng, `circle-${i}`)
    const d = metresBetween(SF.lat, SF.lng, a.latitude, a.longitude)
    assert.ok(d > 280, `seed ${i}: centre only ${d.toFixed(0)}m from the real point`)
  }
})

test('the same circle always gets the same area', () => {
  const a = approxArea(SF.lat, SF.lng, 'circle-abc')
  for (let i = 0; i < 20; i++) {
    const b = approxArea(SF.lat, SF.lng, 'circle-abc')
    assert.equal(b.latitude, a.latitude)
    assert.equal(b.longitude, a.longitude)
  }
})

test('averaging many renders does not recover the true point', () => {
  // The attack a random-per-request offset would allow. The offset is derived
  // from the id, so every sample is identical and the mean is the offset
  // centre, not the meeting place.
  const n = 500
  let sumLat = 0
  let sumLng = 0
  for (let i = 0; i < n; i++) {
    const a = approxArea(SF.lat, SF.lng, 'circle-xyz')
    sumLat += a.latitude
    sumLng += a.longitude
  }
  const d = metresBetween(SF.lat, SF.lng, sumLat / n, sumLng / n)
  assert.ok(d > 280, `averaging landed ${d.toFixed(0)}m from the true point`)
})

test('different circles at one venue get different areas', () => {
  // Otherwise two circles meeting at the same park would share a centre, and
  // the overlap would narrow the search.
  const a = approxArea(SF.lat, SF.lng, 'circle-one')
  const b = approxArea(SF.lat, SF.lng, 'circle-two')
  assert.notEqual(a.latitude, b.latitude)
  assert.notEqual(a.longitude, b.longitude)
})

test('the offset holds its distance far from the equator', () => {
  // Longitude degrees shorten towards the poles. Without the cos(latitude)
  // correction the offset collapses in the east-west direction up north.
  for (const lat of [0, 37.81, 55.95, 71.0]) {
    for (let i = 0; i < 50; i++) {
      const a = approxArea(lat, 10, `seed-${i}`)
      const d = metresBetween(lat, 10, a.latitude, a.longitude)
      assert.ok(
        d > 280 && d < BLUR_RADIUS_M,
        `lat ${lat}, seed ${i}: offset was ${d.toFixed(0)}m`
      )
    }
  }
})

test('works either side of the antimeridian and the equator', () => {
  for (const [lat, lng] of [[-33.87, 151.21], [64.14, -21.94], [-0.19, -78.47]]) {
    const a = approxArea(lat, lng, 'edge')
    const d = metresBetween(lat, lng, a.latitude, a.longitude)
    assert.ok(Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
    assert.ok(d > 280 && d < BLUR_RADIUS_M, `at ${lat},${lng} offset was ${d.toFixed(0)}m`)
  }
})
