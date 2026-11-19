-- ---------------------------------------------------------------------------
-- AI agents: quotas and scheduled RSVPs. 2026-11-18
--
-- Two agents call the Claude API: public search on the landing page
-- (signed out) and Ask Circles (signed in). See docs/agents/.
--
-- 1. ai_quota. Counters for rate limits and spend caps: per IP, per user,
--    and global. Nothing outside the server may read or write it. The table
--    has no policies and no grants for anon or authenticated, and the only
--    way in is ai_take_quota() / ai_add_tokens(), which are executable by
--    service_role alone. If anon could call them, anyone could burn someone
--    else's bucket, or reset their own.
--
--    Remember the trap from function-grants-2026-09-29: revoking EXECUTE from
--    PUBLIC is inert against anon and authenticated, which Supabase grants
--    explicitly. Each role is revoked by name below, and the checks at the
--    end prove it.
--
-- 2. scheduled_check_ins. "Can't go" said for a meet whose check-in hasn't
--    opened yet. The validate_check_in trigger refuses early answers, so the
--    answer waits here, and apply_scheduled_check_ins() writes it once the
--    window opens. pg_cron runs that every 15 minutes. A check-in the person
--    gave by hand in the meantime wins: the apply step never overwrites one.
--
-- Additive. The deployed app is unaffected.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. ai_quota
-- ---------------------------------------------------------------------------
create table if not exists public.ai_quota (
  bucket       text        not null,
  window_start timestamptz not null,
  requests     integer     not null default 0,
  tokens       bigint      not null default 0,
  primary key (bucket, window_start)
);

alter table public.ai_quota enable row level security;
revoke all on public.ai_quota from public, anon, authenticated;

-- Fixed windows: the window an instant falls in starts at the epoch-aligned
-- multiple of p_window_seconds. Cheap, and good enough for abuse limits.
create or replace function public.ai_window(p_window_seconds integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
$$;

-- Takes one request from the bucket if it is under both limits. Returns true
-- when the request may go ahead. Atomic: concurrent callers serialise on the
-- row lock taken by the upsert.
create or replace function public.ai_take_quota(
  p_bucket         text,
  p_window_seconds integer,
  p_max_requests   integer,
  p_max_tokens     bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w   timestamptz := public.ai_window(p_window_seconds);
  row public.ai_quota;
begin
  insert into public.ai_quota as q (bucket, window_start, requests)
  values (p_bucket, w, 0)
  on conflict (bucket, window_start) do nothing;

  select * into row from public.ai_quota
  where bucket = p_bucket and window_start = w
  for update;

  if row.requests >= p_max_requests then
    return false;
  end if;
  if p_max_tokens is not null and row.tokens >= p_max_tokens then
    return false;
  end if;

  update public.ai_quota set requests = requests + 1
  where bucket = p_bucket and window_start = w;
  return true;
end;
$$;

-- Records what a request actually spent, after the model has answered.
create or replace function public.ai_add_tokens(
  p_bucket         text,
  p_window_seconds integer,
  p_tokens         bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_quota as q (bucket, window_start, tokens)
  values (p_bucket, public.ai_window(p_window_seconds), greatest(p_tokens, 0))
  on conflict (bucket, window_start) do update set tokens = q.tokens + excluded.tokens
$$;

-- Old windows are useless after a day. Called by pg_cron below.
create or replace function public.ai_quota_prune()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_quota where window_start < now() - interval '2 days'
$$;

revoke execute on function public.ai_window(integer)                         from public, anon, authenticated;
revoke execute on function public.ai_take_quota(text, integer, integer, bigint) from public, anon, authenticated;
revoke execute on function public.ai_add_tokens(text, integer, bigint)        from public, anon, authenticated;
revoke execute on function public.ai_quota_prune()                            from public, anon, authenticated;
grant  execute on function public.ai_take_quota(text, integer, integer, bigint) to service_role;
grant  execute on function public.ai_add_tokens(text, integer, bigint)        to service_role;

-- ---------------------------------------------------------------------------
-- 2. scheduled_check_ins
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_check_ins (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  circle_id  uuid not null references public.circles(id) on delete cascade,
  occurs_on  date not null,
  status     text not null check (status in ('yes', 'no', 'maybe')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  -- Set when the answer could never be applied: the meet finished, the date
  -- was not a real occurrence, or the person left the circle.
  failed     text,
  primary key (user_id, circle_id, occurs_on)
);

create index if not exists scheduled_check_ins_pending_idx
  on public.scheduled_check_ins (occurs_on) where applied_at is null and failed is null;

alter table public.scheduled_check_ins enable row level security;
revoke all on public.scheduled_check_ins from anon;

drop policy if exists "scheduled_check_ins: own read"   on public.scheduled_check_ins;
drop policy if exists "scheduled_check_ins: own insert" on public.scheduled_check_ins;
drop policy if exists "scheduled_check_ins: own update" on public.scheduled_check_ins;
drop policy if exists "scheduled_check_ins: own delete" on public.scheduled_check_ins;

create policy "scheduled_check_ins: own read" on public.scheduled_check_ins
  for select to authenticated using (user_id = auth.uid());

-- Only for a circle you are in, and only for a date that has not passed.
create policy "scheduled_check_ins: own insert" on public.scheduled_check_ins
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_circle_member(circle_id, auth.uid())
    and occurs_on >= current_date - 1
    and occurs_on <= current_date + 60
    and applied_at is null and failed is null
  );

-- Changing your mind before it is applied. Once applied, the real check-in
-- is the thing to change.
create policy "scheduled_check_ins: own update" on public.scheduled_check_ins
  for update to authenticated
  using (user_id = auth.uid() and applied_at is null)
  with check (user_id = auth.uid() and applied_at is null and failed is null);

create policy "scheduled_check_ins: own delete" on public.scheduled_check_ins
  for delete to authenticated using (user_id = auth.uid() and applied_at is null);

grant select, insert, update, delete on public.scheduled_check_ins to authenticated;

-- Writes due answers. Security definer, so it re-checks membership itself:
-- RLS is not there to do it.
create or replace function public.apply_scheduled_check_ins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s       public.scheduled_check_ins;
  applied integer := 0;
begin
  for s in
    select * from public.scheduled_check_ins
    where applied_at is null and failed is null
      and occurs_on between current_date - 1 and current_date + 2
    order by occurs_on
    for update skip locked
  loop
    if not public.is_circle_member(s.circle_id, s.user_id) then
      update public.scheduled_check_ins set failed = 'no longer a member'
      where user_id = s.user_id and circle_id = s.circle_id and occurs_on = s.occurs_on;
      continue;
    end if;

    begin
      -- An answer given by hand since then wins.
      insert into public.circle_check_ins (circle_id, user_id, occurs_on, status)
      values (s.circle_id, s.user_id, s.occurs_on, s.status)
      on conflict (circle_id, user_id, occurs_on) do nothing;

      update public.scheduled_check_ins set applied_at = now()
      where user_id = s.user_id and circle_id = s.circle_id and occurs_on = s.occurs_on;
      applied := applied + 1;
    exception when others then
      -- Not open yet: leave it for a later run. Anything else is final.
      if sqlerrm not like 'check-in opens%' then
        update public.scheduled_check_ins set failed = left(sqlerrm, 200)
        where user_id = s.user_id and circle_id = s.circle_id and occurs_on = s.occurs_on;
      end if;
    end;
  end loop;

  -- Anything whose date has gone by without applying will never apply.
  update public.scheduled_check_ins set failed = 'meet passed before check-in opened'
  where applied_at is null and failed is null and occurs_on < current_date - 1;

  return applied;
end;
$$;

revoke execute on function public.apply_scheduled_check_ins() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Schedules. pg_cron is already in use for reminders.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
      where jobname in ('apply-scheduled-check-ins', 'ai-quota-prune');
    perform cron.schedule('apply-scheduled-check-ins', '*/15 * * * *', 'select public.apply_scheduled_check_ins()');
    perform cron.schedule('ai-quota-prune', '17 4 * * *', 'select public.ai_quota_prune()');
  else
    raise warning 'pg_cron is not installed: scheduled check-ins will not apply until it is';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Post-conditions. Any failure rolls the whole migration back.
-- ---------------------------------------------------------------------------
do $$
declare
  r text;
  f text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array[
      'public.ai_take_quota(text, integer, integer, bigint)',
      'public.ai_add_tokens(text, integer, bigint)',
      'public.ai_quota_prune()',
      'public.apply_scheduled_check_ins()'
    ] loop
      if has_function_privilege(r, f, 'execute') then
        raise exception 'post-condition: % can execute %', r, f;
      end if;
    end loop;
    if has_table_privilege(r, 'public.ai_quota', 'select')
       or has_table_privilege(r, 'public.ai_quota', 'insert')
       or has_table_privilege(r, 'public.ai_quota', 'update') then
      raise exception 'post-condition: % has privileges on ai_quota', r;
    end if;
  end loop;

  if not has_function_privilege('service_role', 'public.ai_take_quota(text, integer, integer, bigint)', 'execute') then
    raise exception 'post-condition: service_role cannot take quota';
  end if;
  if has_table_privilege('anon', 'public.scheduled_check_ins', 'select') then
    raise exception 'post-condition: anon can read scheduled_check_ins';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.scheduled_check_ins'::regclass) then
    raise exception 'post-condition: RLS is off on scheduled_check_ins';
  end if;
end $$;

commit;
