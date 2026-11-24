-- ---------------------------------------------------------------------------
-- Push notifications. 2026-11-24
--
-- One row per device that turned notifications on (a Web Push subscription:
-- the browser's endpoint URL and its two keys). A person can have several:
-- phone and laptop. Rows are the person's own: they add, read and remove
-- their own and nobody else's. Sending reads them with the service role.
--
-- Three notifications, nothing else:
--   checkin   check-in opened (24 h before) on a meet you haven't answered
--   soon      a meet you said yes to starts in about 3 hours
--   message   someone messaged you (sent from the send-message action)
--
-- The first two come from due_push_notifications(), called by the existing
-- 15-minute reminder cron, using the same occurrence bands as the email
-- reminders. push_sends is the claim log that stops a retry sending twice.
-- Both are service-role only.
-- ---------------------------------------------------------------------------

begin;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;

drop policy if exists "push: own rows" on public.push_subscriptions;
create policy "push: own rows" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.push_sends (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  occurs_on date not null,
  kind      text not null check (kind in ('checkin', 'soon')),
  sent_at   timestamptz not null default now(),
  primary key (user_id, circle_id, occurs_on, kind)
);
alter table public.push_sends enable row level security;
revoke all on table public.push_sends from anon, authenticated;

create or replace function public.due_push_notifications()
returns table (
  user_id     uuid,
  circle_id   uuid,
  circle_name text,
  timezone    text,
  place       text,
  occurs_on   date,
  kind        text,
  starts_at   timestamptz
)
language sql security definer set search_path = public as $$
  with occurrences as (
    select
      c.id   as circle_id,
      c.name as circle_name,
      c.timezone,
      coalesce(c.neighborhood, c.location) as place,
      d::date as occurs_on,
      ((d::date + cs.start_time) at time zone c.timezone) as starts_at
    from public.circles c
    join public.circle_schedules cs on cs.circle_id = c.id
    cross join generate_series(
      (now() at time zone c.timezone)::date,
      (now() at time zone c.timezone)::date + 2,
      interval '1 day'
    ) as d
    where public.schedule_occurs_on(cs.days_of_week, cs.frequency, cs.starts_on, d::date)
  ),
  windows as (
    -- Same non-overlapping bands as the email reminders: 'checkin' from the
    -- moment check-in opens (24 h) until 3 h before; 'soon' from 3 h until
    -- 30 min before. A run that misses a band sends nothing rather than
    -- something wrong.
    select o.*, k.kind
    from occurrences o
    cross join (values
      ('checkin', interval '24 hours', interval '3 hours'),
      ('soon',    interval '3 hours',  interval '30 minutes')
    ) as k(kind, lead, floor)
    where o.starts_at - now() <= k.lead
      and o.starts_at - now() >  k.floor
  )
  select distinct on (m.user_id, w.circle_id, w.occurs_on, w.kind)
    m.user_id, w.circle_id, w.circle_name, w.timezone, w.place, w.occurs_on, w.kind, w.starts_at
  from windows w
  join public.circle_members m on m.circle_id = w.circle_id
  where exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
    and not exists (
      select 1 from public.push_sends p
      where p.user_id = m.user_id and p.circle_id = w.circle_id
        and p.occurs_on = w.occurs_on and p.kind = w.kind
    )
    and case w.kind
      -- Not answered, and no answer saved to send when the window opened.
      when 'checkin' then
        not exists (select 1 from public.circle_check_ins ci
                    where ci.circle_id = w.circle_id and ci.user_id = m.user_id and ci.occurs_on = w.occurs_on)
        and not exists (select 1 from public.scheduled_check_ins sc
                        where sc.circle_id = w.circle_id and sc.user_id = m.user_id and sc.occurs_on = w.occurs_on
                          and sc.failed is null)
      -- Said yes.
      when 'soon' then
        exists (select 1 from public.circle_check_ins ci
                where ci.circle_id = w.circle_id and ci.user_id = m.user_id
                  and ci.occurs_on = w.occurs_on and ci.status = 'yes')
      else false
    end
  order by m.user_id, w.circle_id, w.occurs_on, w.kind, w.starts_at;
$$;

revoke all on function public.due_push_notifications() from public, anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.due_push_notifications()', 'execute')
     or has_function_privilege('authenticated', 'public.due_push_notifications()', 'execute') then
    raise exception 'post-condition: due_push_notifications is callable by clients';
  end if;
  if has_table_privilege('authenticated', 'public.push_sends', 'select') then
    raise exception 'post-condition: push_sends is readable by clients';
  end if;
  if has_table_privilege('authenticated', 'public.push_subscriptions', 'update') then
    raise exception 'post-condition: push_subscriptions should not be updatable';
  end if;
end $$;

commit;
