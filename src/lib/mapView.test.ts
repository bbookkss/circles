import { test } from 'node:test'
import assert from 'node:assert/strict'
import { geoFromHeaders, resolveMapView, viewForPoints, distanceKm, SF_VIEW } from './mapView.ts'

/** Fake request headers. */
const hdrs = (map: Record<string, string>) => (name: string) => map[name] ?? null

const SF = { latitude: 37.7749, longitude: -122.4194 }
const SANTA_MONICA = { latitude: 34.0164, longitude: -118.5052 }
const FLORIDA = { latitude: 27.4337, longitude: -82.6847 }

test('branch 1: opens on the circles you are in', () => {
  const { view, place } = resolveMapView([SF, { latitude: 37.8, longitude: -122.43 }], null)
  assert.ok(Math.abs(view.latitude - 37.79) < 0.1, `latitude was ${view.latitude}`)
  assert.ok(Math.abs(view.longitude - -122.42) < 0.1, `longitude was ${view.longitude}`)
  assert.ok(view.zoom >= 10, 'city-level or closer')
  assert.equal(place, null, 'no city name is claimed when circles decided it')
})

test('branch 1: one distant circle does not zoom out to the country', () => {
  const { view } = resolveMapView([SF, SF, SF, SANTA_MONICA, FLORIDA], null)
  assert.ok(view.zoom >= 10, `outlier dragged zoom to ${view.zoom}`)
  assert.ok(Math.abs(view.latitude - 37.77) < 0.5, 'still centred on the cluster')
})

test('branch 2: falls back to the IP headers, with the city name', () => {
  const geo = geoFromHeaders(hdrs({
    'x-vercel-ip-latitude': '41.8781',
    'x-vercel-ip-longitude': '-87.6298',
    'x-vercel-ip-city': 'Chicago',
  }))
  const { view, place } = resolveMapView([], geo)
  assert.equal(view.latitude, 41.8781)
  assert.equal(view.longitude, -87.6298)
  assert.equal(place, 'Chicago')
})

test('branch 2: percent-encoded city names are decoded', () => {
  const geo = geoFromHeaders(hdrs({
    'x-vercel-ip-latitude': '37.7749',
    'x-vercel-ip-longitude': '-122.4194',
    'x-vercel-ip-city': 'San%20Francisco',
  }))
  assert.equal(geo?.city, 'San Francisco')
})

test('branch 2: a malformed city is used as-is rather than throwing', () => {
  const geo = geoFromHeaders(hdrs({
    'x-vercel-ip-latitude': '1',
    'x-vercel-ip-longitude': '1',
    'x-vercel-ip-city': '100%',
  }))
  assert.equal(geo?.city, '100%')
})

test('branch 3: no circles and no headers lands on San Francisco', () => {
  const { view, place } = resolveMapView([], geoFromHeaders(hdrs({})))
  assert.deepEqual(view, SF_VIEW)
  assert.equal(place, null)
})

test('your circles win over the IP headers', () => {
  const geo = geoFromHeaders(hdrs({
    'x-vercel-ip-latitude': '41.8781',
    'x-vercel-ip-longitude': '-87.6298',
    'x-vercel-ip-city': 'Chicago',
  }))
  const { view, place } = resolveMapView([SF], geo)
  assert.ok(Math.abs(view.latitude - SF.latitude) < 0.1, 'centred on the circle, not the IP')
  assert.equal(place, null)
})

test('rubbish headers are ignored rather than centring on null island', () => {
  assert.equal(geoFromHeaders(hdrs({})), null, 'absent')
  assert.equal(geoFromHeaders(hdrs({ 'x-vercel-ip-latitude': '', 'x-vercel-ip-longitude': '' })), null, 'empty')
  assert.equal(geoFromHeaders(hdrs({ 'x-vercel-ip-latitude': 'abc', 'x-vercel-ip-longitude': 'def' })), null, 'not numbers')
  assert.equal(geoFromHeaders(hdrs({ 'x-vercel-ip-latitude': '0', 'x-vercel-ip-longitude': '0' })), null, '0,0')
  assert.equal(geoFromHeaders(hdrs({ 'x-vercel-ip-latitude': '999', 'x-vercel-ip-longitude': '5' })), null, 'out of range')
})

test('circles with no coordinates are skipped, not treated as 0,0', () => {
  const { view } = resolveMapView(
    [{ latitude: null, longitude: null }, { latitude: null, longitude: null }],
    null
  )
  assert.deepEqual(view, SF_VIEW, 'null coordinates must not produce a view')
})

test('viewForPoints returns null for nothing', () => {
  assert.equal(viewForPoints([]), null)
})

test('four circles in four cities do not centre on a phantom median point', () => {
  // Baltimore, New York, Los Angeles, San Francisco. Independent medians of
  // lat and lng used to land in the Nevada mountains, near none of them.
  const pts = [
    { latitude: 39.2904, longitude: -76.6122 },
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 34.0522, longitude: -118.2437 },
    { latitude: 37.7749, longitude: -122.4194 },
  ]
  const v = viewForPoints(pts)!
  const onAPoint = pts.some((p) => distanceKm(p, v) < 5)
  assert.ok(onAPoint, `centre ${v.latitude},${v.longitude} is not on any circle`)
})

test('with an anchor, the cluster nearest the visitor wins', () => {
  const pts = [
    { latitude: 39.2904, longitude: -76.6122 }, // Baltimore
    { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
    { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
  ]
  // Standing in Brooklyn: Baltimore is the nearest circle, even though the
  // West Coast pair is the bigger cluster.
  const v = viewForPoints(pts, { anchor: { latitude: 40.65, longitude: -73.95 } })!
  assert.ok(distanceKm(v, pts[0]) < 5)
  // No anchor: the bigger cluster.
  const w = viewForPoints(pts)!
  assert.ok(distanceKm(w, pts[1]) < 5 || distanceKm(w, pts[2]) < 5)
})
