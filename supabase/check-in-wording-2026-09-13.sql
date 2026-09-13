-- ---------------------------------------------------------------------------
-- Check-in error wording — 2026-09-13
--
-- Supersedes the messages raised by validate_check_in() in
-- check-ins-2026-09-08.sql. The logic is byte-for-byte the one already
-- applied; only the two strings a person can actually read have changed.
--
-- "that meet" reads as though the app is talking about something elsewhere.
-- The person is looking straight at the card they just clicked, so it is
-- this meet. Same for the circle.
--
-- These strings surface rarely but at the worst moment: the UI already
-- computes the same window client-side and disables the button, so a person
-- only sees these if the meet ended between the page rendering and their
-- click. Worth them reading like the app knows what they are looking at.
-- ---------------------------------------------------------------------------

create or replace function public.validate_check_in()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s          record;
  tz         text;
  meet_start timestamptz;
  meet_end   timestamptz;
begin
  -- Is occurs_on actually a day this circle meets?
  select * into s
  from public.circle_schedules cs
  where cs.circle_id = new.circle_id
    and public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, new.occurs_on)
  limit 1;

  if not found then
    raise exception 'this circle does not meet on %', new.occurs_on
      using errcode = 'check_violation';
  end if;

  select c.timezone into tz from public.circles c where c.id = new.circle_id;

  -- Local wall-clock time of the meet, in the circle's own timezone.
  meet_start := (new.occurs_on + s.start_time) at time zone tz;
  meet_end   := (new.occurs_on + s.end_time)   at time zone tz;

  if now() < meet_start - interval '24 hours' then
    raise exception 'check-in opens 24 hours before the meet'
      using errcode = 'check_violation';
  end if;

  if now() > meet_end then
    raise exception 'this meet has already finished'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
