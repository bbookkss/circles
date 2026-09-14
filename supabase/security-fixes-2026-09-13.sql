-- Security fixes from the pre-pilot audit, 2026-09-13
-- ---------------------------------------------------------------------------
-- Two confirmed breaks and the policy drift underneath them. Each was
-- rehearsed against production in a rolled-back transaction before this file
-- was written; the numbers refer to the audit in PRODUCTION.md.
--
--   1. Anyone signed in could self-join a private circle by posting its id.
--   2. Approving a join request could not insert the member (RLS keys the
--      INSERT to the requester's own uid), and the action redirected past
--      the error, so the requester was told they were in and was not.
--   3. Every write policy on circles / schedules was keyed to created_by,
--      so a second admin's edits silently affected 0 rows, and a circle whose
--      creator left or deleted their account could never be edited again.
--   4. Admins had no way to remove a member or delete someone else's post.
--   5. circles.visibility accepted any string.
--
-- Run in the dashboard SQL editor. Wrapped in one transaction so a failure
-- leaves the policies exactly as they were.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- Who counts as an admin. Security definer so it can be used inside policies
-- on circle_members itself without recursing through RLS (the trap that
-- broke every read on 2026-09-06, see HANDOFF.md).
-- ---------------------------------------------------------------------------
create or replace function public.is_circle_admin(cid uuid, uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = cid and m.user_id = uid and m.role = 'admin'
  );
$$;
revoke all on function public.is_circle_admin(uuid, uuid) from public;
grant execute on function public.is_circle_admin(uuid, uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1. Self-join is for public circles only, and only ever as a member.
--
-- The creator is the exception: createCircle inserts the creator's own row
-- with role 'admin' straight after the circle, including for private
-- circles, and that must keep working. Nobody else can hand themselves
-- 'admin' on the way in, which was also possible before.
-- ---------------------------------------------------------------------------
drop policy if exists "members: auth insert" on public.circle_members;
create policy "members: self-join" on public.circle_members
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      -- creator joining their own circle, any visibility, as admin
      exists (select 1 from public.circles c
               where c.id = circle_id and c.created_by = auth.uid())
      or
      -- everyone else: public circles, member role only
      (public.circle_is_public(circle_id) and role = 'member')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Approval as one atomic, admin-checked call.
--
-- Security definer because the admin is inserting a row for somebody else,
-- which no sane INSERT policy should allow directly. The function is the
-- only path by which a private membership is created.
-- ---------------------------------------------------------------------------
create or replace function public.approve_join_request(p_circle uuid, p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_circle_admin(p_circle, me) then
    raise exception 'only an admin of this circle can approve requests'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.circle_join_requests r
    where r.circle_id = p_circle and r.user_id = p_user and r.status = 'pending'
  ) then
    raise exception 'no pending request from that person'
      using errcode = 'no_data_found';
  end if;

  update public.circle_join_requests
     set status = 'approved'
   where circle_id = p_circle and user_id = p_user;

  insert into public.circle_members (circle_id, user_id, role)
  values (p_circle, p_user, 'member')
  on conflict (circle_id, user_id) do nothing;

  insert into public.notifications (user_id, actor_id, type, circle_id)
  values (p_user, me, 'request_approved', p_circle);
end;
$$;
revoke all on function public.approve_join_request(uuid, uuid) from public;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Writes keyed to the admin role, not to whoever typed the name first.
-- ---------------------------------------------------------------------------
drop policy if exists "circles: creator update" on public.circles;
create policy "circles: admin update" on public.circles
  for update to authenticated
  using (public.is_circle_admin(id, auth.uid()))
  with check (public.is_circle_admin(id, auth.uid()));

drop policy if exists "circles: creator delete" on public.circles;
create policy "circles: admin delete" on public.circles
  for delete to authenticated
  using (public.is_circle_admin(id, auth.uid()));

drop policy if exists "schedules: creator insert" on public.circle_schedules;
create policy "schedules: admin insert" on public.circle_schedules
  for insert to authenticated
  with check (public.is_circle_admin(circle_id, auth.uid()));

drop policy if exists "schedules: creator delete" on public.circle_schedules;
create policy "schedules: admin delete" on public.circle_schedules
  for delete to authenticated
  using (public.is_circle_admin(circle_id, auth.uid()));

create policy "schedules: admin update" on public.circle_schedules
  for update to authenticated
  using (public.is_circle_admin(circle_id, auth.uid()))
  with check (public.is_circle_admin(circle_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Moderation. Admins can remove members and delete posts and comments in
--    their own circle. "members: own delete" (leaving) stays as it is.
-- ---------------------------------------------------------------------------
create policy "members: admin remove" on public.circle_members
  for delete to authenticated
  using (user_id <> auth.uid() and public.is_circle_admin(circle_id, auth.uid()));

create policy "posts: admin delete" on public.posts
  for delete to authenticated
  using (public.is_circle_admin(circle_id, auth.uid()));

create policy "post_comments: admin delete" on public.post_comments
  for delete to authenticated
  using (public.is_circle_admin(public.post_circle(post_id), auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Visibility is one of two words.
-- ---------------------------------------------------------------------------
alter table public.circles
  add constraint circles_visibility_check
  check (visibility in ('public', 'private'));

-- ---------------------------------------------------------------------------
-- Post-conditions. Raise, and therefore roll back, if anything is off.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'circle_members'
     and policyname in ('members: self-join', 'members: admin remove', 'members: own delete');
  if n <> 3 then raise exception 'circle_members policies: expected 3, found %', n; end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('circles','circle_schedules')
     and policyname like '%creator%';
  if n <> 0 then raise exception '% creator-keyed policies survived on circles/schedules', n; end if;

  if not exists (select 1 from pg_proc where proname = 'approve_join_request') then
    raise exception 'approve_join_request missing';
  end if;
end $$;

commit;
