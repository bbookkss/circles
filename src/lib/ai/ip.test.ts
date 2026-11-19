import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIp, ipBucket } from './ip.ts'

const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null

test('on Vercel, trusts x-real-ip and ignores a spoofed x-forwarded-for', () => {
  const get = headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' })
  assert.equal(clientIp(get, true), '203.0.113.7')
})

test('off Vercel, nothing is trusted and everyone shares one bucket', () => {
  assert.equal(clientIp(headers({ 'x-real-ip': '203.0.113.7' }), false), 'local')
})

test('a missing or absurd header is its own bucket, not a bypass', () => {
  assert.equal(clientIp(headers({}), true), 'unknown')
  assert.equal(clientIp(headers({ 'x-real-ip': 'x'.repeat(500) }), true), 'unknown')
})

test('IPv4 is bucketed by address', () => {
  assert.equal(ipBucket('203.0.113.7'), '203.0.113.7')
})

test('IPv6 is bucketed by /64, so rotating the host half does not help', () => {
  const a = ipBucket('2001:db8:abcd:12:1111:2222:3333:4444')
  const b = ipBucket('2001:db8:abcd:12:ffff::1')
  assert.equal(a, b)
  assert.equal(a, '2001:db8:abcd:12::/64')
  assert.notEqual(a, ipBucket('2001:db8:abcd:13::1'))
})

test('IPv6 with :: in the prefix expands before cutting', () => {
  assert.equal(ipBucket('2001:db8::1'), '2001:db8:0:0::/64')
  assert.equal(ipBucket('::1'), '0:0:0:0::/64')
})
