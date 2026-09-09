-- ---------------------------------------------------------------------------
-- Schedule anchor and occurrence maths — 2026-09-08
--
-- circle_schedules described a pattern, not dated events: days_of_week plus a
-- frequency, with nothing to anchor the recurrence. 'biweekly' was therefore
-- undefined — nothing said which week was the "on" week — and the app quietly
-- ignored frequency altogether, so a biweekly circle displayed as if it met
-- every week.
--
-- A schedule now starts on a date the organiser picks, and everything is
-- extrapolated from it. The maths lives here rather than in TypeScript because
-- check-ins will need the database to validate a date it was handed, and two
-- implementations of a recurrence rule will drift.
-- ---------------------------------------------------------------------------

alter table public.circle_schedules
  add column if not exists starts_on date;

-- Existing schedules start the day they were created. That keeps weekly
-- correct (it always was), and gives biweekly and monthly a defensible anchor.
update public.circle_schedules
set starts_on = coalesce(created_at::date, current_date)
where starts_on is null;

alter table public.circle_schedules
  alter column starts_on set default current_date;
alter table public.circle_schedules
  alter column starts_on set not null;

-- New column, and the previous migration revoked table-level UPDATE from
-- authenticated on profiles only — circle_schedules still has its table grant,
-- so nothing extra is needed here. Recorded so the omission looks deliberate.


-- ---------------------------------------------------------------------------
-- Does a schedule fall on a given date?
--
--   weekly    every week, on each listed weekday
--   biweekly  every second week, aligned to the week containing starts_on
--   monthly   the same ordinal weekday each month as starts_on
--             (2nd Tuesday stays the 2nd Tuesday)
--
-- Weeks are Sunday-based to match extract(dow), which is what days_of_week
-- already stores.
-- ---------------------------------------------------------------------------
create or replace function public.schedule_occurs_on(
  p_days      integer[],
  p_freq      text,
  p_starts_on date,
  p_date      date
)
returns boolean
language sql immutable as $$
  select
    p_date >= p_starts_on
    and extract(dow from p_date)::int = any(p_days)
    and case p_freq
      when 'weekly' then true
      when 'biweekly' then
        ((((p_date      - extract(dow from p_date)::int)
         - (p_starts_on - extract(dow from p_starts_on)::int)) / 7) % 2) = 0
      when 'monthly' then
        ((extract(day from p_date)::int - 1) / 7)
        = ((extract(day from p_starts_on)::int - 1) / 7)
      else true
    end;
$$;


-- ---------------------------------------------------------------------------
-- The next date a circle meets, on or after from_date. Null if it has no
-- schedule, or none inside the look-ahead window.
--
-- 62 days of look-ahead so a monthly circle always resolves.
-- ---------------------------------------------------------------------------
create or replace function public.circle_next_occurrence(
  cid       uuid,
  from_date date default current_date
)
returns date
language sql stable security definer set search_path = public as $$
  select min(g::date)
  from public.circle_schedules s
  cross join generate_series(from_date::timestamp,
                             (from_date + 62)::timestamp,
                             interval '1 day') g
  where s.circle_id = cid
    and public.schedule_occurs_on(s.days_of_week, s.frequency, s.starts_on, g::date);
$$;


-- Batch form, so the home page resolves every circle in one round trip
-- instead of one query per circle.
create or replace function public.circles_next_occurrence(
  cids      uuid[],
  from_date date default current_date
)
returns table (circle_id uuid, occurs_on date)
language sql stable security definer set search_path = public as $$
  select s.circle_id, min(g::date) as occurs_on
  from public.circle_schedules s
  cross join generate_series(from_date::timestamp,
                             (from_date + 62)::timestamp,
                             interval '1 day') g
  where s.circle_id = any(cids)
    and public.schedule_occurs_on(s.days_of_week, s.frequency, s.starts_on, g::date)
  group by s.circle_id;
$$;


revoke all on function public.schedule_occurs_on(integer[], text, date, date) from public;
revoke all on function public.circle_next_occurrence(uuid, date) from public;
revoke all on function public.circles_next_occurrence(uuid[], date) from public;

-- Derived entirely from data anon can already read on a public circle page.
grant execute on function public.schedule_occurs_on(integer[], text, date, date) to anon, authenticated;
grant execute on function public.circle_next_occurrence(uuid, date) to anon, authenticated;
grant execute on function public.circles_next_occurrence(uuid[], date) to anon, authenticated;
