import type { createClient } from '@/lib/supabase/server'

/**
 * Shared types for the Ask Circles tools.
 *
 * Every tool runs on `ctx.supabase`, the signed-in person's own client, so
 * RLS decides what it can read. `ctx.userId` comes from the session in the
 * route, never from the model.
 */

export type Supa = Awaited<ReturnType<typeof createClient>>
export type Status = 'yes' | 'no' | 'maybe'

export type Thumb = { lat: number; lng: number; exact: boolean }

/** One upcoming meet of one of the person's circles. */
export type Meet = {
  circle_id: string
  occurs_on: string
  circle_name: string
  emoji: string | null
  day_label: string // "Today", "Tomorrow", "Saturday"
  time_label: string // "7:00 PM – 9:00 PM"
  timezone: string
  open: boolean
  opens_label: string | null // when check-in opens, if it hasn't yet
  my_status: Status | null
  scheduled_status: Status | null
  going: string[] // first names, "you" excluded
  maybe_count: number
  venue: string | null
  thumb: Thumb | null
}

export type Card =
  | { kind: 'meet'; meet: Meet }
  | { kind: 'proposal'; meet: Meet; suggested: Status }
  | { kind: 'message'; from_id: string; from_name: string; sent_at: string; text: string; unread: boolean }
  | {
      kind: 'circle'
      circle_id: string
      name: string
      emoji: string | null
      neighborhood: string | null
      category: string | null
      days: number[]
      member_count: number
      is_member: boolean
      thumb: Thumb | null
    }
  | { kind: 'navigate'; lat: number; lng: number; zoom: number; label: string }

export type Ctx = {
  supabase: Supa
  userId: string
  tz: string
  today: string
  /** Rough location for "near you", from the request (IP city) when available. */
  near: { latitude: number; longitude: number } | null
  /** The person's next two weeks, fetched once per request and shared by tools. */
  week: () => Promise<Meet[]>
}

export type ToolOutput = { forModel: unknown; cards: Card[] }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const STATUSES: readonly Status[] = ['yes', 'no', 'maybe']
export const meetKey = (circleId: string, occursOn: string) => `${circleId}|${occursOn}`
