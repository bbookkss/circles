-- ---------------------------------------------------------------------------
-- More notifications, and a switch for each kind. 2026-11-24
--
-- New kinds:
--   friends   two or more people you follow said yes to a meet you haven't
--             answered ("Ana and Sam are going")              once per meet
--   going     new yes answers on a meet you're going to, or one you run:
--             a digest of who's new                    at most every 3 hours
--   changes   the circle's time, days or place changed (sent from the edit
--             action to everyone who answered yes or maybe)
--   requests  someone asked to join a circle you run (sent from the action)
--
-- Every kind has its own switch in user_settings, on unless turned off. A
-- missing settings row means everything on.
--
-- Quiet hours: the cron-sent kinds (check-in open, 3 hours before, friends,
-- going) wait while it's 10pm–8am where the circle meets. They're still due
-- in the morning if the meet hasn't passed; a 3-hours-before notice for a
-- 7am meet is simply skipped.
-- ---------------------------------------------------------------------------

begin;

alter table public.user_settings
  add column if not exists push_checkin_open boolean not null default true,
  add column if not exists push_soon         boolean not null default true,
  add column if not exists push_messages     boolean not null default true,
  add column if not exists push_friends      boolean not null default true,
  add column if not exists push_going        boolean not null default true,
  add column if not exists push_changes      boolean not null default true,
  add column if not exists push_requests     boolean not null default true;

alter table public.push_sends drop constraint if exists push_sends_kind_check;
alter table public.push_sends add constraint push_sends_kind_check
  check (kind in ('checkin', 'soon', 'friends'));

-- When each person last got a "who's going" digest for a meet.
create table if not exists public.push_digests (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  circle_id    uuid not null references public.circles(id) on delete cascade,
  occurs_on    date not null,
  last_sent_at timestamptz not null,
  primary key (user_id, circle_id, occurs_on)
);
alter table public.push_digests enable row level security;
revoke all on table public.push_digests from anon, authenticated;

-- Wants this kind? A missing row means yes.
create or replace function public.push_wants(p_user uuid, p_kind text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_kind
      when 'checkin'  then s.push_checkin_open
      when 'soon'     then s.push_soon
      when 'messages' then s.push_messages
      when 'friends'  then s.push_friends
      when 'going'    then s.push_going
      when 'changes'  then s.push_changes
      when 'requests' then s.push_requests
    end
    from public.user_settings s where s.user_id = p_user
  ), true)
  and exists (select 1 from public.push_subscriptions ps where ps.user_id = p_user);
$$;

-- Meets whose check-in window is open now (24 h before the start, until it
-- starts), outside quiet hours where they happen.
create or replace function public.push_open_meets()
returns table (circle_id uuid, circle_name text, timezone text, place text, occurs_on date, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.circle_id, o.circle_name, o.timezone, o.place, o.occurs_on, o.starts_at
  from (
    select c.id as circle_id, c.name as circle_name, c.timezone,
           coalesce(c.neighborhood, c.location) as place, d::date as occurs_on,
           ((d::date + cs.start_time) at time zone c.timezone) as starts_at
    from public.circles c
    join public.circle_schedules cs on cs.circle_id = c.id
    cross join generate_series((now() at time zone c.timezone)::date,
                               (now() at time zone c.timezone)::date + 1, interval '1 day') as d
    where public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, d::date)
  ) o
  where o.starts_at > now()
    and o.starts_at - now() <= interval '24 hours'
    and extract(hour from now() at time zone o.timezone) between 8 and 21;
$$;

-- Redefined with the per-kind switch and quiet hours.
create or replace function public.due_push_notifications()
returns table (
  user_id uuid, circle_id uuid, circle_name text, timezone text, place text,
  occurs_on date, kind text, starts_at timestamptz
)
language sql security definer set search_path = public as $$
  with occurrences as (
    select c.id as circle_id, c.name as circle_name, c.timezone,
           coalesce(c.neighborhood, c.location) as place, d::date as occurs_on,
           ((d::date + cs.start_time) at time zone c.timezone) as starts_at
    from public.circles c
    join public.circle_schedules cs on cs.circle_id = c.id
    cross join generate_series((now() at time zone c.timezone)::date,
                               (now() at time zone c.timezone)::date + 2, interval '1 day') as d
    where public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, d::date)
  ),
  windows as (
    select o.*, k.kind
    from occurrences o
    cross join (values
      ('checkin', interval '24 hours', interval '3 hours'),
      ('soon',    interval '3 hours',  interval '30 minutes')
    ) as k(kind, lead, floor)
    where o.starts_at - now() <= k.lead
      and o.starts_at - now() >  k.floor
      and extract(hour from now() at time zone o.timezone) between 8 and 21
  )
  select distinct on (m.user_id, w.circle_id, w.occurs_on, w.kind)
    m.user_id, w.circle_id, w.circle_name, w.timezone, w.place, w.occurs_on, w.kind, w.starts_at
  from windows w
  join public.circle_members m on m.circle_id = w.circle_id
  where public.push_wants(m.user_id, w.kind)
    and not exists (
      select 1 from public.push_sends p
      where p.user_id = m.user_id and p.circle_id = w.circle_id
        and p.occurs_on = w.occurs_on and p.kind = w.kind
    )
    and case w.kind
      when 'checkin' then
        not exists (select 1 from public.circle_check_ins ci
                    where ci.circle_id = w.circle_id and ci.user_id = m.user_id and ci.occurs_on = w.occurs_on)
        and not exists (select 1 from public.scheduled_check_ins sc
                        where sc.circle_id = w.circle_id and sc.user_id = m.user_id and sc.occurs_on = w.occurs_on
                          and sc.failed is null)
      when 'soon' then
        exists (select 1 from public.circle_check_ins ci
                where ci.circle_id = w.circle_id and ci.user_id = m.user_id
                  and ci.occurs_on = w.occurs_on and ci.status = 'yes')
      else false
    end
  order by m.user_id, w.circle_id, w.occurs_on, w.kind, w.starts_at;
$$;

-- "Ana and Sam are going": members who haven't answered, when at least two
-- people they follow have said yes. Once per meet.
create or replace function public.due_friend_pushes()
returns table (
  user_id uuid, circle_id uuid, circle_name text, timezone text, occurs_on date,
  starts_at timestamptz, names text[], total int
)
language sql security definer set search_path = public as $$
  select m.user_id, o.circle_id, o.circle_name, o.timezone, o.occurs_on, o.starts_at,
         (array_agg(split_part(coalesce(p.full_name, 'Someone'), ' ', 1) order by ci.updated_at))[1:2],
         count(*)::int
  from public.push_open_meets() o
  join public.circle_members m on m.circle_id = o.circle_id
  join public.follows f on f.follower_id = m.user_id
  join public.circle_check_ins ci
    on ci.circle_id = o.circle_id and ci.occurs_on = o.occurs_on
   and ci.user_id = f.following_id and ci.status = 'yes'
  join public.profiles p on p.id = ci.user_id
  where public.push_wants(m.user_id, 'friends')
    and not exists (select 1 from public.circle_check_ins mine
                    where mine.circle_id = o.circle_id and mine.occurs_on = o.occurs_on and mine.user_id = m.user_id)
    and not exists (select 1 from public.scheduled_check_ins sc
                    where sc.circle_id = o.circle_id and sc.occurs_on = o.occurs_on and sc.user_id = m.user_id
                      and sc.failed is null)
    and not exists (select 1 from public.push_sends s
                    where s.user_id = m.user_id and s.circle_id = o.circle_id
                      and s.occurs_on = o.occurs_on and s.kind = 'friends')
  group by m.user_id, o.circle_id, o.circle_name, o.timezone, o.occurs_on, o.starts_at
  having count(*) >= 2;
$$;

-- "Sam and 2 others said yes": for people going to a meet, and for the
-- circle's admins whatever they answered. New yes answers since the last
-- digest (or since they said yes themselves, or since check-in opened).
-- At most every 3 hours per meet.
create or replace function public.due_going_digests()
returns table (
  user_id uuid, circle_id uuid, circle_name text, timezone text, occurs_on date,
  starts_at timestamptz, names text[], new_count int, going int
)
language sql security definer set search_path = public as $$
  with audience as (
    select m.user_id, o.*,
           greatest(
             o.starts_at - interval '24 hours',
             coalesce(d.last_sent_at, '-infinity'),
             coalesce((select mine.updated_at from public.circle_check_ins mine
                       where mine.circle_id = o.circle_id and mine.occurs_on = o.occurs_on
                         and mine.user_id = m.user_id and m.role <> 'admin'), '-infinity')
           ) as since,
           d.last_sent_at
    from public.push_open_meets() o
    join public.circle_members m on m.circle_id = o.circle_id
    left join public.push_digests d
      on d.user_id = m.user_id and d.circle_id = o.circle_id and d.occurs_on = o.occurs_on
    where public.push_wants(m.user_id, 'going')
      and (m.role = 'admin' or exists (
            select 1 from public.circle_check_ins mine
            where mine.circle_id = o.circle_id and mine.occurs_on = o.occurs_on
              and mine.user_id = m.user_id and mine.status = 'yes'))
      and (d.last_sent_at is null or now() - d.last_sent_at >= interval '3 hours')
  )
  select a.user_id, a.circle_id, a.circle_name, a.timezone, a.occurs_on, a.starts_at,
         (array_agg(split_part(coalesce(p.full_name, 'Someone'), ' ', 1) order by ci.updated_at)
            filter (where ci.updated_at > a.since))[1:2],
         (count(*) filter (where ci.updated_at > a.since))::int,
         count(*)::int
  from audience a
  join public.circle_check_ins ci
    on ci.circle_id = a.circle_id and ci.occurs_on = a.occurs_on
   and ci.status = 'yes' and ci.user_id <> a.user_id
  join public.profiles p on p.id = ci.user_id
  group by a.user_id, a.circle_id, a.circle_name, a.timezone, a.occurs_on, a.starts_at
  having count(*) filter (where ci.updated_at > a.since) > 0;
$$;

revoke all on function public.push_wants(uuid, text) from public, anon, authenticated;
revoke all on function public.push_open_meets() from public, anon, authenticated;
revoke all on function public.due_push_notifications() from public, anon, authenticated;
revoke all on function public.due_friend_pushes() from public, anon, authenticated;
revoke all on function public.due_going_digests() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.push_wants(uuid, text)', 'public.push_open_meets()',
    'public.due_push_notifications()', 'public.due_friend_pushes()', 'public.due_going_digests()'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'post-condition: % is callable by clients', f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.push_digests', 'select') then
    raise exception 'post-condition: push_digests readable by clients';
  end if;
  -- Smoke: the functions run.
  perform count(*) from public.due_push_notifications();
  perform count(*) from public.due_friend_pushes();
  perform count(*) from public.due_going_digests();
end $$;

commit;
