-- ---------------------------------------------------------------------------
-- Local time for schedules — 2026-09-08
--
-- Everything was being computed in UTC: Postgres current_date on Supabase, and
-- new Date() on Vercel. For a California app that means the whole product
-- believes it is tomorrow from ~5pm local onward. Harmless-looking on a
-- schedule list, fatal for "check in within 24 hours of the meet".
--
-- Circles are physical places, so the timezone comes from the pin. The app
-- resolves it from latitude/longitude with tz-lookup whenever a circle is
-- created or its location moves; the backfill below does the same for rows
-- that already existed.
--
-- The default only applies to a circle with no coordinates at all, which today
-- means the two untitled test rows.
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


-- ---------------------------------------------------------------------------
-- Backfill existing circles from their coordinates.
--
-- Resolved with tz-lookup against each circle's stored latitude/longitude.
-- Note TEST Florida: a blanket Pacific default would already have been wrong
-- for it, which is why this is derived from the pin rather than assumed.
-- Circles with no coordinates keep the default.
-- ---------------------------------------------------------------------------
update public.circles set timezone = 'America/New_York'
where id = '0787fe73-6d35-4b68-9b01-c867d4b8b51e';   -- TEST Florida, Longboat Key

update public.circles set timezone = 'America/Los_Angeles'
where id in (
  '9ebceb00-fc30-4738-8fc5-8e32ddb4e9c4',  -- basketball, SF
  'bcd4d428-6e2b-42d2-910e-cae381a48920',  -- Beach volleyball (baker beach), SF
  'e75d0453-a2b8-4a10-8c63-f1e7dfa7e944',  -- SAMO beach volleyball, Santa Monica
  'b10d2c5e-7348-4f84-8a97-962c1278d92c',  -- Surf Club, SF
  '56f8b442-b1ce-4812-a25c-3f18d3364f1f',  -- TEST Street autofill, SF
  '5350d7ef-9f6e-457c-bb6c-0b29c0bcf117'   -- WIne club, SF
);
