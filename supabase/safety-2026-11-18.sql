-- ---------------------------------------------------------------------------
-- Block and report — 2026-11-18
--
-- Posts, comments and DMs are user-generated content, and the App Store
-- requires a way to report it and to block the person behind it (guideline
-- 1.2). dm-follow-2026-09-13.sql took a known trade-off, a stranger can
-- follow you and then message you, on the understanding that block would
-- follow. This is that.
--
-- Block. Either side of a block stops seeing the other:
--   - no new messages, and the existing conversation is hidden from both
--   - no follows; blocking removes them in both directions
--   - posts and comments by the other person are hidden in shared circles
--   - no notifications from them, old or new
-- It does not remove anyone from a circle. That is the circle admin's call
-- ("members: admin remove"), and a block should not reveal itself by
-- changing a circle's member list.
--
-- Enforced in RLS, through one helper that only ever asks about the caller,
-- private.blocked_with(other). A pair version would let anyone ask whether
-- two strangers have blocked each other. It lives in a schema PostgREST does
-- not expose, so it cannot be called over the API to learn who blocked you;
-- policies can still run it, because the roles hold USAGE and EXECUTE.
--
-- Report. file_report() is the only way in. It checks the reporter can see
-- what they are reporting and snapshots the content at that moment, so a
-- report survives the author deleting the post. Platform admins read reports
-- and resolve them with resolve_report(), which can also remove the post or
-- comment.
--
-- Then run safety-2026-11-18.rehearsal.sql.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. blocks
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You can see and undo your own blocks. You cannot see who has blocked you.
-- No insert policy: block_user() is the way in, because a block also has to
-- delete the other person's follow, which the blocker has no right to do.
drop policy if exists "blocks: own read" on public.blocks;
create policy "blocks: own read" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "blocks: own delete" on public.blocks;
create policy "blocks: own delete" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;

-- Does a block stand between the caller and `other`, in either direction?
-- Granted to anon as well as authenticated because it sits inside policies,
-- and a policy calling a function the role cannot execute fails the whole
-- query rather than filtering it. For anon, auth.uid() is null: false.
--
-- Not in public: anything there is an RPC, and this one answers "has this
-- person blocked me?", which the person who blocked you is promised you
-- cannot find out. Supabase's API exposes public and graphql_public only.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = auth.uid() and blocked_id = other)
        or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

revoke all on function private.blocked_with(uuid) from public;
grant execute on function private.blocked_with(uuid) to anon, authenticated;

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_target is null or p_target = me then
    raise exception 'you cannot block yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'no such person' using errcode = 'P0002';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (me, p_target)
  on conflict do nothing;

  delete from public.follows
   where (follower_id = me and following_id = p_target)
      or (follower_id = p_target and following_id = me);
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Blocks applied to what already exists.
--
-- Each policy is recreated with its current condition plus the block check.
-- The post-conditions at the end assert each table/command has exactly one
-- policy, because permissive policies OR together: a second, forgotten
-- SELECT policy on messages would quietly undo the filter added here.
-- ---------------------------------------------------------------------------

-- messages
drop policy if exists "messages: insert if following" on public.messages;
create policy "messages: insert if following" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = recipient_id
    )
    and not private.blocked_with(recipient_id)
  );

drop policy if exists "messages: read own" on public.messages;
create policy "messages: read own" on public.messages
  for select using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and not private.blocked_with(case when sender_id = auth.uid() then recipient_id else sender_id end)
  );

-- follows
drop policy if exists "follows: own insert" on public.follows;
create policy "follows: own insert" on public.follows
  for insert with check (
    auth.uid() = follower_id
    and not private.blocked_with(following_id)
  );

-- posts and comments
drop policy if exists "posts: members read" on public.posts;
create policy "posts: members read" on public.posts
  for select using (
    public.can_read_circle_content(circle_id, auth.uid())
    and not private.blocked_with(user_id)
  );

drop policy if exists "post_comments: read" on public.post_comments;
create policy "post_comments: read" on public.post_comments
  for select using (
    public.can_read_circle_content(public.post_circle(post_id), auth.uid())
    and not private.blocked_with(user_id)
  );

-- notifications
drop policy if exists "notifications: actor insert" on public.notifications;
create policy "notifications: actor insert" on public.notifications
  for insert with check (
    auth.uid() = actor_id
    and not private.blocked_with(user_id)
  );

drop policy if exists "notifications: own read" on public.notifications;
create policy "notifications: own read" on public.notifications
  for select using (
    auth.uid() = user_id
    and not private.blocked_with(actor_id)
  );

-- ---------------------------------------------------------------------------
-- 3. reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles(id) on delete set null,
  target_type      text not null check (target_type in ('user', 'post', 'comment', 'circle')),
  target_id        uuid not null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  circle_id        uuid references public.circles(id) on delete set null,
  reason           text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'other')),
  details          text check (char_length(details) <= 2000),
  -- What the reporter saw, captured server-side. Not editable by anyone.
  snapshot         text,
  status           text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null
);

-- One open report per person per thing. Reporting again updates it.
create unique index if not exists reports_one_open
  on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index if not exists reports_open_by_age
  on public.reports (created_at desc) where status = 'open';

alter table public.reports enable row level security;

drop policy if exists "reports: platform admins read" on public.reports;
create policy "reports: platform admins read" on public.reports
  for select to authenticated using (public.is_platform_admin(auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

create or replace function public.file_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns table (report_id uuid, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_user uuid;
  v_circle uuid;
  v_snapshot text;
  v_id uuid;
  v_new boolean;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Each report emails a person. Thirty an hour is far past honest use.
  if (select count(*) from public.reports r
       where r.reporter_id = me and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many reports; try again later' using errcode = '54000';
  end if;

  -- Only what the reporter can actually see. A post in a private circle is
  -- not reportable by someone outside it, because they never saw it.
  if p_target_type = 'post' then
    select p.user_id, p.circle_id, p.content
      into v_user, v_circle, v_snapshot
      from public.posts p
     where p.id = p_target_id
       and public.can_read_circle_content(p.circle_id, me);

  elsif p_target_type = 'comment' then
    select c.user_id, public.post_circle(c.post_id), c.content
      into v_user, v_circle, v_snapshot
      from public.post_comments c
     where c.id = p_target_id
       and public.can_read_circle_content(public.post_circle(c.post_id), me);

  elsif p_target_type = 'circle' then
    -- Any circle someone has the link to, private ones included: the name
    -- and description are what a preview shows.
    select c.created_by, c.id, concat_ws(E'\n\n', c.name, c.description)
      into v_user, v_circle, v_snapshot
      from public.circles c
     where c.id = p_target_id;

  elsif p_target_type = 'user' then
    -- The profile, plus the last five messages they sent the reporter, which
    -- is usually what the report is about.
    select p.id,
           concat_ws(E'\n\n',
             p.full_name,
             p.bio,
             (select string_agg(to_char(m.created_at, 'YYYY-MM-DD HH24:MI') || '  ' || m.content, E'\n' order by m.created_at)
                from (select created_at, content from public.messages
                       where sender_id = p.id and recipient_id = me
                       order by created_at desc limit 5) m))
      into v_user, v_snapshot
      from public.profiles p
     where p.id = p_target_id;

  else
    raise exception 'unknown report type %', p_target_type using errcode = '22023';
  end if;

  if not found then
    raise exception 'nothing to report' using errcode = 'P0002';
  end if;
  if v_user = me then
    raise exception 'you cannot report yourself' using errcode = '22023';
  end if;

  insert into public.reports
    (reporter_id, target_type, target_id, reported_user_id, circle_id, reason, details, snapshot)
  values
    (me, p_target_type, p_target_id, v_user, v_circle, p_reason, nullif(btrim(p_details), ''), left(v_snapshot, 4000))
  on conflict (reporter_id, target_type, target_id) where status = 'open'
  do update set
    reason = excluded.reason,
    details = excluded.details,
    snapshot = excluded.snapshot
  -- xmax is 0 on a row this statement inserted, and set on one it updated:
  -- the caller emails only for a new report, not for each re-file.
  returning id, (xmax = 0) into v_id, v_new;

  return query select v_id, v_new;
end;
$$;

revoke all on function public.file_report(text, uuid, text, text) from public, anon;
grant execute on function public.file_report(text, uuid, text, text) to authenticated;

-- p_action: 'remove' deletes the post or comment and closes every open
-- report on it; 'actioned' and 'dismissed' close this one report.
create or replace function public.resolve_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.reports;
begin
  if me is null or not public.is_platform_admin(me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'no such report' using errcode = 'P0002';
  end if;

  if p_action = 'remove' then
    if r.target_type = 'post' then
      delete from public.posts where id = r.target_id;
    elsif r.target_type = 'comment' then
      delete from public.post_comments where id = r.target_id;
    else
      raise exception 'only posts and comments can be removed' using errcode = '22023';
    end if;

    update public.reports
       set status = 'actioned', resolved_at = now(), resolved_by = me
     where target_type = r.target_type and target_id = r.target_id and status = 'open';

  elsif p_action in ('actioned', 'dismissed') then
    update public.reports
       set status = p_action, resolved_at = now(), resolved_by = me
     where id = p_report_id;

  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions. A failure here rolls the whole file back.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
  n int;
begin
  for t in
    select * from (values
      ('messages', 'SELECT'), ('messages', 'INSERT'),
      ('follows', 'INSERT'),
      ('posts', 'SELECT'), ('post_comments', 'SELECT'),
      ('notifications', 'SELECT'), ('notifications', 'INSERT')
    ) as v(tbl, cmd)
  loop
    select count(*) into n from pg_policies
     where schemaname = 'public' and tablename = t.tbl and cmd in (t.cmd, 'ALL');
    if n <> 1 then
      raise exception '% has % % policies; expected exactly 1, or the block check can be bypassed',
        t.tbl, n, t.cmd;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.block_user(uuid)', 'execute')
     or has_function_privilege('anon', 'public.file_report(text,uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.resolve_report(uuid,text)', 'execute') then
    raise exception 'anon can execute a block or report function';
  end if;

  if has_table_privilege('authenticated', 'public.reports', 'insert')
     or has_table_privilege('authenticated', 'public.reports', 'update')
     or has_table_privilege('authenticated', 'public.blocks', 'insert') then
    raise exception 'blocks or reports writable directly; the functions must be the only way in';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
