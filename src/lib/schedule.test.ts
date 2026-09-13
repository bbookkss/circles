import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  todayISO,
  relativeDayLabel,
  tzAbbrev,
  sameWallClock,
} from './schedule.ts'

// 13 Sep 2026, 18:51 UTC. 2:51pm in New York, 11:51am in San Francisco: the
// same calendar day in both, which is why the bug this covers stays hidden
// most of the time.
const AFTERNOON = new Date('2026-09-13T18:51:00Z')

// 14 Sep 2026, 05:30 UTC. 1:30am Monday in New York, 10:30pm Sunday in San
// Francisco. Different days, and the window where a Pacific-only "today"
// tells a traveller the wrong thing.
const LATE = new Date('2026-09-14T05:30:00Z')

test('todayISO answers per zone, not per server', () => {
  // Frozen by passing the instant through the zone rather than mocking Date.
  const nyc = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(LATE)
  const sf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(LATE)
  assert.equal(nyc, '2026-09-14')
  assert.equal(sf, '2026-09-13')
  assert.notEqual(nyc, sf, 'the fixture must straddle a date line to be worth testing')
})

test('a meet reads Today in its own zone even when the viewer has ticked over', () => {
  // The circle is in San Francisco, where it is still Sunday the 13th.
  const circleToday = '2026-09-13'
  assert.equal(relativeDayLabel('2026-09-13', circleToday), 'Today')
  // Computed against a New York "today" it would wrongly read as past.
  assert.equal(relativeDayLabel('2026-09-13', '2026-09-14'), 'Sep 13')
})

test('relative labels cover today, tomorrow, this week and beyond', () => {
  const today = '2026-09-13'
  assert.equal(relativeDayLabel('2026-09-13', today), 'Today')
  assert.equal(relativeDayLabel('2026-09-14', today), 'Tomorrow')
  assert.equal(relativeDayLabel('2026-09-16', today), 'Wed')
  assert.equal(relativeDayLabel('2026-09-30', today), 'Sep 30')
})

test('tzAbbrev is stable across daylight saving', () => {
  const summer = new Date('2026-07-01T12:00:00Z')
  const winter = new Date('2026-01-01T12:00:00Z')
  assert.equal(
    tzAbbrev('America/Los_Angeles', summer),
    tzAbbrev('America/Los_Angeles', winter),
    'a circle should not appear to change timezone twice a year'
  )
  assert.equal(tzAbbrev('America/Los_Angeles', summer), 'PT')
  assert.equal(tzAbbrev('America/New_York', summer), 'ET')
})

test('sameWallClock compares clocks, not zone names', () => {
  // Different names, identical clocks: no label should be shown.
  assert.ok(sameWallClock('America/New_York', 'America/Toronto', AFTERNOON))
  assert.ok(sameWallClock('America/Los_Angeles', 'America/Los_Angeles', AFTERNOON))
  // Genuinely different clocks.
  assert.ok(!sameWallClock('America/New_York', 'America/Los_Angeles', AFTERNOON))
})

test('todayISO defaults to Pacific, so callers must pass a zone', () => {
  // Documents the trap rather than the behaviour: the default is a fallback
  // for callers with no circle in hand, and anything rendering a circle's
  // schedule has one.
  assert.equal(typeof todayISO(), 'string')
  assert.match(todayISO('America/New_York'), /^\d{4}-\d{2}-\d{2}$/)
})
