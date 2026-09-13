-- ---------------------------------------------------------------------------
-- Email reminders — 2026-09-13
--
-- Members opt in to being emailed 24 hours and 3 hours before a circle meets.
--
-- Three layers of consent, checked in this order, because they answer
-- different questions and the strictest has to win:
--
--   email_suppressions   "never email this address again". Keyed by address
--                        rather than user id on purpose: an unsubscribe link
--                        has to work without signing in, and the suppression
--                        has to outlive the account. Delete the account, sign
--                        up again with the same address, still suppressed.
--                        This is the layer CAN-SPAM actually cares about.
--
--   profiles.email_reminders
--                        "do I want reminders at all". Set at signup, default
--                        false, because opting people in by default is how
--                        you end up in spam folders.
--
--   circle_members.email_reminders
--                        "do I want reminders for this circle". Default true,
--                        so joining a circle does what a member expects, and
--                        one noisy circle can be muted without losing the
--                        channel entirely.
--
-- Sending is deliberately not in here. This file decides *who is owed what*;
-- delivery is the app's job.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Consent
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email_reminders boolean not null default false;

alter table public.circle_members
  add column if not exists email_reminders boolean not null default true;

-- Address-keyed, so it survives account deletion and re-signup. Lowercased by
-- a trigger rather than by trusting callers: "Ben@x.com" and "ben@x.com" are
-- the same inbox, and a suppression that misses on case is not a suppression.
create table if not exists public.email_suppressions (
  email      text primary key,
  reason     text not null default 'user_request',
  created_at timestamptz not null default now()
);

create or replace function public.lower_suppression_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists email_suppressions_lower on public.email_suppressions;
create trigger email_suppressions_lower
  before insert or update on public.email_suppressions
  for each row execute function public.lower_suppression_email();


-- ---------------------------------------------------------------------------
-- One-click unsubscribe
--
-- A per-person secret that is not the user id, so the link cannot be guessed
-- from anything public and revoking it is a single update. Regenerated on
-- demand if a link ever leaks.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsubscribe_token_idx
  on public.profiles (unsubscribe_token);


-- ---------------------------------------------------------------------------
-- What has already been sent
--
-- The primary key is the whole point. A scheduler that runs every fifteen
-- minutes will see the same meet in its window several times over, and this
-- is what stops the same person being emailed on each pass. Claim the row
-- first, then send: losing one reminder to a failed send is a smaller problem
-- than mailing somebody the same thing four times.
-- ---------------------------------------------------------------------------

create table if not exists public.email_reminder_sends (
  circle_id uuid not null references public.circles(id)  on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  occurs_on date not null,
  kind      text not null check (kind in ('24h', '3h')),
  sent_at   timestamptz not null default now(),
  primary key (circle_id, user_id, occurs_on, kind)
);

create index if not exists email_reminder_sends_sent_at_idx
  on public.email_reminder_sends (sent_at desc);


-- ---------------------------------------------------------------------------
-- Who is owed a reminder right now
--
-- Windows rather than exact instants: a scheduler is never punctual, and a
-- reminder that fires a few minutes late is still useful. The lower bound
-- matters more than the upper one. If the job is down for two hours, the 3h
-- reminder should still go at 2h05m, but a "3 hours before" email that lands
-- ten minutes before the meet is worse than silence, so p_floor drops it.
--
-- Everything is evaluated in the circle's own timezone, because that is where
-- the meet happens.
-- ---------------------------------------------------------------------------

create or replace function public.due_email_reminders(
  p_floor interval default interval '30 minutes'
)
returns table (
  circle_id   uuid,
  circle_name text,
  timezone    text,
  place       text,
  user_id     uuid,
  email       text,
  full_name   text,
  occurs_on   date,
  kind        text,
  starts_at   timestamptz,
  unsubscribe_token uuid
)
language sql security definer set search_path = public, auth as $$
  with occurrences as (
    -- Only the next two days can be within 24 hours of now in any timezone.
    select
      c.id   as circle_id,
      c.name as circle_name,
      c.timezone,
      coalesce(c.neighborhood, c.location) as place,
      d::date as occurs_on,
      cs.start_time,
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
    -- Each kind owns a band, and the bands do not overlap. Without the upper
    -- floor on '24h' a meet two hours away would match "<= 24 hours" and send
    -- a message headed "tomorrow" two hours before the meet, which is how a
    -- missed run turns into a wrong email rather than a late one.
    select o.*, k.kind
    from occurrences o
    cross join (values
      ('24h', interval '24 hours', interval '3 hours'),
      ('3h',  interval '3 hours',  p_floor)
    ) as k(kind, lead, floor)
    where o.starts_at - now() <= k.lead
      and o.starts_at - now() >  k.floor
  )
  select
    w.circle_id,
    w.circle_name,
    w.timezone,
    w.place,
    m.user_id,
    u.email::text,
    p.full_name,
    w.occurs_on,
    w.kind,
    w.starts_at,
    p.unsubscribe_token
  from windows w
  join public.circle_members m on m.circle_id = w.circle_id
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where p.email_reminders                     -- wants reminders at all
    and m.email_reminders                     -- wants them for this circle
    and u.email is not null
    and not exists (                          -- has not opted out of everything
      select 1 from public.email_suppressions s where s.email = lower(u.email)
    )
    and not exists (                          -- has not already been sent this
      select 1 from public.email_reminder_sends r
      where r.circle_id = w.circle_id
        and r.user_id = m.user_id
        and r.occurs_on = w.occurs_on
        and r.kind = w.kind
    );
$$;


-- ---------------------------------------------------------------------------
-- Policies
--
-- The send log and the suppression list are service-role only. Neither is
-- something a signed-in user should read: one is a record of who was mailed
-- and when, the other is a list of email addresses.
-- ---------------------------------------------------------------------------

alter table public.email_suppressions   enable row level security;
alter table public.email_reminder_sends enable row level security;

revoke all on table public.email_suppressions   from anon, authenticated;
revoke all on table public.email_reminder_sends from anon, authenticated;

-- due_email_reminders reads auth.users and every member's address, so it is
-- service-role only too. It is security definer, which makes the revoke the
-- only thing standing between a signed-in user and the whole mailing list.
revoke all on function public.due_email_reminders(interval) from public, anon, authenticated;

-- Members manage their own preference on their own membership row.
--
-- circle_members had no UPDATE policy at all, only SELECT, so with RLS on
-- every update was already denied. Adding the obvious row policy on its own
-- would have been worse than useless: circle_members carries `role`, so
-- "update your own row" means "make yourself an admin of any circle you have
-- joined". RLS chooses rows and cannot choose columns.
--
-- So the row policy is paired with a column grant. Blanket UPDATE is revoked
-- from authenticated and handed back for exactly one column, which is what
-- stops the escalation. Postgres rejects an UPDATE that touches any other
-- column with "permission denied for column", rather than silently ignoring
-- it.
--
-- Nothing else in the app updates this table directly. The one update that
-- exists lives inside delete_own_account(), which is security definer and
-- runs as the owner, so it is unaffected by grants on authenticated.

drop policy if exists "members: update own email prefs" on public.circle_members;
create policy "members: update own email prefs" on public.circle_members
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.circle_members from authenticated;
grant  update (email_reminders) on public.circle_members to authenticated;

-- Same shape for the profile-level flag: profiles has an owner-scoped update
-- policy already, but granting the whole table would let someone edit columns
-- that are not theirs to set. Only add the two new ones.
grant update (email_reminders, unsubscribe_token) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- Verified 2026-09-13, against production, inside a transaction that was
-- rolled back so no fixture survived.
--
-- Opting one member in and giving a circle a meet 20 hours out produced
-- exactly one due row, of kind '24h' and not '3h'. That is the band doing its
-- job: before the upper floor existed the same row matched both windows, and
-- the person would have received "tomorrow" and "in 3 hours" together.
--
-- Claiming that row into email_reminder_sends dropped the due count to zero,
-- which is the guarantee the scheduler depends on. It will see the same meet
-- dozens of times between now and then and must send once.
--
-- Reproduce with:
--
--   begin;
--   update public.profiles set email_reminders = true where id = '<user>';
--   insert into public.circle_schedules (circle_id, days_of_week, start_time,
--     end_time, frequency, starts_on)
--   select m.circle_id,
--          array[extract(dow from ((now() at time zone c.timezone)::date + 1))::int],
--          ((now() at time zone c.timezone) + interval '20 hours')::time,
--          ((now() at time zone c.timezone) + interval '22 hours')::time,
--          'weekly', current_date
--   from public.circle_members m
--   join public.circles c on c.id = m.circle_id
--   where m.user_id = '<user>' limit 1;
--   select kind, count(*) from due_email_reminders() group by kind;
--   insert into public.email_reminder_sends (circle_id, user_id, occurs_on, kind)
--   select circle_id, user_id, occurs_on, kind from due_email_reminders();
--   select count(*) as should_be_zero from due_email_reminders();
--   rollback;
-- ---------------------------------------------------------------------------
