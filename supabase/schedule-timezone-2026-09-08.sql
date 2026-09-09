-- ---------------------------------------------------------------------------
-- Local time for schedules — 2026-09-08
--
-- Everything was being computed in UTC: Postgres current_date on Supabase, and
-- new Date() on Vercel. For a California app that means the whole product
-- believes it is tomorrow from ~5pm local onward. Harmless-looking on a
-- schedule list, fatal for "check in within 24 hours of the meet".
--
-- Circles are physical places, so the correct answer is a timezone per circle.
-- Every circle today is Pacific, so the column defaults to that and nothing
-- has to be decided per circle until a circle exists outside it.
-- ---------------------------------------------------------------------------

alter table public.circles
  add column if not exists timezone text not null default 'America/Los_Angeles';

-- Guard against a typo silently producing UTC: an unknown zone name would
-- otherwise fail at read time, far from where it was set. This is a trigger
-- rather than a CHECK because a CHECK constraint cannot contain a subquery,
-- and the set of valid zone names lives in pg_timezone_names.
create or replace function public.validate_circle_timezone()
returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists circles_timezone_guard on public.circles;
create trigger circles_timezone_guard
  before insert or update of timezone on public.circles
  for each row execute function public.validate_circle_timezone();


-- Today, where the circle actually is.
create or replace function public.circle_today(cid uuid)
returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.circles c where c.id = cid),
    'America/Los_Angeles'
  ))::date;
$$;


-- Both occurrence functions now anchor to the circle's own today rather than
-- the server's. Passing from_date explicitly still overrides, which is what
-- the tests use.
create or replace function public.circle_next_occurrence(
  cid       uuid,
  from_date date default null
)
returns date
language sql stable security definer set search_path = public as $$
  select min(g::date)
  from public.circle_schedules s
  cross join generate_series(
    coalesce(from_date, public.circle_today(cid))::timestamp,
    (coalesce(from_date, public.circle_today(cid)) + 62)::timestamp,
    interval '1 day') g
  where s.circle_id = cid
    and public.schedule_occurs_on(s.days_of_week, s.frequency, s.starts_on, g::date);
$$;


create or replace function public.circles_next_occurrence(
  cids      uuid[],
  from_date date default null
)
returns table (circle_id uuid, occurs_on date)
language sql stable security definer set search_path = public as $$
  select s.circle_id, min(g::date) as occurs_on
  from public.circle_schedules s
  cross join lateral generate_series(
    coalesce(from_date, public.circle_today(s.circle_id))::timestamp,
    (coalesce(from_date, public.circle_today(s.circle_id)) + 62)::timestamp,
    interval '1 day') g
  where s.circle_id = any(cids)
    and public.schedule_occurs_on(s.days_of_week, s.frequency, s.starts_on, g::date)
  group by s.circle_id;
$$;


revoke all on function public.circle_today(uuid) from public;
revoke all on function public.circle_next_occurrence(uuid, date) from public;
revoke all on function public.circles_next_occurrence(uuid[], date) from public;

grant execute on function public.circle_today(uuid) to anon, authenticated;
grant execute on function public.circle_next_occurrence(uuid, date) to anon, authenticated;
grant execute on function public.circles_next_occurrence(uuid[], date) to anon, authenticated;
