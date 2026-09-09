-- ---------------------------------------------------------------------------
-- Check-ins — 2026-09-08
--
-- Within 24 hours of a meet, members say whether they are coming. A circle
-- lives or dies on whether enough people show up, so this turns "there is a
-- schedule" into "six people are actually going".
--
-- Visibility follows the rule the RLS audit already established:
--   public circle  -> any signed-in user can see who checked in
--   private circle -> members only
-- which is precisely can_read_circle_content, so no new access model.
--
-- Writing is narrower than reading: you must be a member to say you are
-- coming, even to a public circle. Join first.
-- ---------------------------------------------------------------------------

create table if not exists public.circle_check_ins (
  circle_id  uuid not null references public.circles(id)  on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  occurs_on  date not null,
  status     text not null check (status in ('yes', 'no', 'maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id, occurs_on)
);

-- One answer per person per occurrence; changing your mind is an upsert, not
-- a second row. That is what the primary key above buys.

create index if not exists circle_check_ins_circle_date_idx
  on public.circle_check_ins (circle_id, occurs_on);


-- ---------------------------------------------------------------------------
-- The date has to be real, and the window has to be open.
--
-- Enforced here rather than in the server action, because a server action is
-- reachable by anyone who can send the same POST — it is not a boundary.
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
    raise exception 'that circle does not meet on %', new.occurs_on
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
    raise exception 'that meet has already finished'
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists circle_check_ins_guard on public.circle_check_ins;
create trigger circle_check_ins_guard
  before insert or update on public.circle_check_ins
  for each row execute function public.validate_check_in();


-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.circle_check_ins enable row level security;

drop policy if exists "check_ins: read"        on public.circle_check_ins;
drop policy if exists "check_ins: insert own"  on public.circle_check_ins;
drop policy if exists "check_ins: update own"  on public.circle_check_ins;
drop policy if exists "check_ins: delete own"  on public.circle_check_ins;

create policy "check_ins: read" on public.circle_check_ins
  for select to authenticated
  using (public.can_read_circle_content(circle_id, auth.uid()));

create policy "check_ins: insert own" on public.circle_check_ins
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_circle_member(circle_id, auth.uid()));

create policy "check_ins: update own" on public.circle_check_ins
  for update to authenticated
  using (auth.uid() = user_id and public.is_circle_member(circle_id, auth.uid()));

create policy "check_ins: delete own" on public.circle_check_ins
  for delete to authenticated
  using (auth.uid() = user_id);

-- anon gets nothing. can_read_circle_content already returns false for a null
-- uid, so this only makes the intent explicit at the grant level too.
revoke all on table public.circle_check_ins from anon;
grant select, insert, update, delete on table public.circle_check_ins to authenticated;
