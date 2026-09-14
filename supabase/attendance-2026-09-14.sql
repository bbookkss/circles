-- Did they actually show?
-- ---------------------------------------------------------------------------
-- "Going" costs nothing to say, so "5 going" means very little, and the
-- question a newcomer actually has is not how many said yes but whether the
-- people who said yes turn up. Doug Hirsch asked it directly: how do I know
-- people will show?
--
-- This records what happened after the meet, and turns it into one number on
-- a profile: shows up 11 of 12. The ratio counts only meets where the person
-- said yes AND somebody afterwards confirmed who was there, so nothing is
-- held against anyone on the strength of an unconfirmed meet.
--
-- Who confirms: any member of the circle, once the meet has ended. Not the
-- admin alone, because asking an admin to file a register every week is how
-- you lose admins, and admins are the scarcest thing in this product. It is
-- self-reportable and therefore gameable, which is an accepted trade: the
-- circle is small, everyone there knows who was there, and a number inflated
-- in front of the people who would know is worth very little. Peer
-- confirmation can be layered on later if gaming turns out to be real rather
-- than theoretical.
--
-- Absences are recorded explicitly rather than inferred from a missing row,
-- so "confirmed absent" and "never confirmed" stay different things. Only the
-- first is allowed to count against anyone.
-- ---------------------------------------------------------------------------

begin;

create table if not exists public.circle_attendance (
  circle_id   uuid not null references public.circles(id)  on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  occurs_on   date not null,
  attended    boolean not null,
  -- Who filed it. Kept for accountability, and set null rather than cascading
  -- so a departed account does not take the record of the meet with it.
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (circle_id, user_id, occurs_on)
);

create index if not exists circle_attendance_user_idx
  on public.circle_attendance (user_id);

alter table public.circle_attendance enable row level security;

-- Readable by anyone who can read the circle's content. Writes go through the
-- function below and nowhere else, so there is no INSERT or UPDATE policy and
-- no write grant: a table anybody could write directly is a table where
-- anybody can award themselves a perfect record.
drop policy if exists "attendance: read" on public.circle_attendance;
create policy "attendance: read" on public.circle_attendance
  for select to authenticated
  using (public.can_read_circle_content(circle_id, auth.uid()));

-- Supabase's default privileges hand `anon` and `authenticated` full DML on
-- every new table in `public`, so a fresh table is writable by everyone until
-- you say otherwise. RLS would still be in the way, but there is no write
-- policy here at all and there should be no grant either: two locks, since
-- the whole value of this table is that people cannot write their own record.
-- The post-condition at the bottom fails the migration if this is ever lost.
revoke all on public.circle_attendance from anon, authenticated;
grant select on public.circle_attendance to authenticated;

-- ---------------------------------------------------------------------------
-- The last meet worth confirming
--
-- Defined as the most recent occurrence that has check-ins against it and has
-- finished. A meet nobody answered has nobody to confirm, which is the right
-- answer rather than a gap.
-- ---------------------------------------------------------------------------
create or replace function public.circle_last_meet(cid uuid)
returns date
language sql stable security definer
set search_path = public
as $$
  select max(ci.occurs_on)
  from public.circle_check_ins ci
  join public.circles c on c.id = ci.circle_id
  join public.circle_schedules cs on cs.circle_id = ci.circle_id
  where ci.circle_id = cid
    and public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, ci.occurs_on)
    and now() > (ci.occurs_on + cs.end_time) at time zone c.timezone;
$$;
revoke all on function public.circle_last_meet(uuid) from public;
grant execute on function public.circle_last_meet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- File the register
--
-- Security definer because a member is writing rows about other people, which
-- no INSERT policy should ever allow directly. Everything the caller could get
-- wrong is checked here: membership, that the date is a real occurrence, and
-- that the meet is actually over.
--
-- Re-filing amends. The last person to confirm wins, on the grounds that
-- somebody correcting the record is usually correcting it.
-- ---------------------------------------------------------------------------
create or replace function public.record_attendance(
  p_circle    uuid,
  p_occurs_on date,
  p_attended  uuid[],
  p_absent    uuid[]
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  tz       text;
  meet_end timestamptz;
  s        record;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_circle_member(p_circle, me) then
    raise exception 'only members of this circle can confirm who came'
      using errcode = 'insufficient_privilege';
  end if;

  select * into s
  from public.circle_schedules cs
  where cs.circle_id = p_circle
    and public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, p_occurs_on)
  limit 1;
  if not found then
    raise exception 'this circle does not meet on %', p_occurs_on
      using errcode = 'check_violation';
  end if;

  select c.timezone into tz from public.circles c where c.id = p_circle;
  meet_end := (p_occurs_on + s.end_time) at time zone tz;
  if now() <= meet_end then
    raise exception 'wait until the meet has finished'
      using errcode = 'check_violation';
  end if;

  -- Only people who answered for this meet can be marked either way. Without
  -- this, the array is an open door to writing rows about anybody.
  insert into public.circle_attendance (circle_id, user_id, occurs_on, attended, recorded_by)
  select p_circle, u, p_occurs_on, true, me
  from unnest(coalesce(p_attended, '{}'::uuid[])) as u
  where exists (
    select 1 from public.circle_check_ins ci
    where ci.circle_id = p_circle and ci.user_id = u and ci.occurs_on = p_occurs_on
  )
  on conflict (circle_id, user_id, occurs_on)
  do update set attended = true, recorded_by = me, recorded_at = now();

  insert into public.circle_attendance (circle_id, user_id, occurs_on, attended, recorded_by)
  select p_circle, u, p_occurs_on, false, me
  from unnest(coalesce(p_absent, '{}'::uuid[])) as u
  where exists (
    select 1 from public.circle_check_ins ci
    where ci.circle_id = p_circle and ci.user_id = u and ci.occurs_on = p_occurs_on
  )
  on conflict (circle_id, user_id, occurs_on)
  do update set attended = false, recorded_by = me, recorded_at = now();
end;
$$;
revoke all on function public.record_attendance(uuid, date, uuid[], uuid[]) from public;
grant execute on function public.record_attendance(uuid, date, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Shows up N of M
--
-- Security definer on purpose. The ratio spans every circle a person belongs
-- to, including ones the viewer cannot see, so it cannot be computed under
-- the viewer's own RLS. What comes back is two integers, which is the point:
-- it says how reliable somebody is without saying where they go.
--
-- Counts only meets the person said yes to and which were later confirmed.
-- Saying no and staying home is not unreliability, and an unconfirmed meet is
-- not evidence of anything.
-- ---------------------------------------------------------------------------
create or replace function public.reliability(uids uuid[])
returns table (user_id uuid, committed int, attended int)
language sql stable security definer
set search_path = public
as $$
  select
    a.user_id,
    count(*)::int,
    count(*) filter (where a.attended)::int
  from public.circle_attendance a
  join public.circle_check_ins ci
    on  ci.circle_id = a.circle_id
    and ci.user_id   = a.user_id
    and ci.occurs_on = a.occurs_on
  where a.user_id = any(uids)
    and ci.status = 'yes'
  group by a.user_id;
$$;
revoke all on function public.reliability(uuid[]) from public;
grant execute on function public.reliability(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'circle_attendance';
  if n <> 1 then raise exception 'expected exactly 1 policy on circle_attendance, found %', n; end if;

  -- A write grant here would make the security-definer function pointless.
  select count(*) into n from information_schema.role_table_grants
   where table_name = 'circle_attendance'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if n > 0 then raise exception '% direct write grant(s) on circle_attendance', n; end if;

  if not exists (select 1 from pg_proc where proname = 'record_attendance') then
    raise exception 'record_attendance missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'reliability') then
    raise exception 'reliability missing';
  end if;
end $$;

commit;
