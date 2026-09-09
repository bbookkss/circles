-- ===========================================================================
-- RLS hardening — APPLIED to production on 2026-09-06. All of this is LIVE.
--
-- This is the consolidated end state, not the order it was run in. Running
-- this file against a fresh database reproduces the current policy set.
-- It supersedes rls-hardening.sql, which was the first draft and contains a
-- recursive circle_members policy that took production reads down. Do not
-- run that file.
--
-- Intent: "public" means discoverable by anyone, readable by account holders.
--   - logged out  -> circle name, description, category, location, schedule,
--                    member COUNT, creator name. Nothing else.
--   - signed in   -> full content of public circles + circles they belong to.
--   - member      -> full content of their private circles.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Helpers. Every policy goes through these rather than an inline subquery.
-- security definer bypasses RLS inside the function, which is what stops a
-- policy on table A from invoking a policy on table B that reads A again.
-- The first attempt used inline subqueries and produced
--   ERROR 42P17: infinite recursion detected in policy for "circle_members"
-- which broke every read on circles/circle_members/circle_schedules/posts.
-- ---------------------------------------------------------------------------
create or replace function public.is_circle_member(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = cid and m.user_id = uid
  );
$$;

create or replace function public.circle_is_public(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.circles c where c.id = cid and c.visibility = 'public'
  );
$$;

-- Can this user SEE the circle at all (for previews, membership, schedules)?
create or replace function public.circle_is_visible(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.circles c
    where c.id = cid
      and (
        c.visibility = 'public'
        or c.created_by = uid
        or public.is_circle_member(c.id, uid)
      )
  );
$$;

-- Can this user read CONTENT (posts/comments/likes) in the circle?
-- Note the `uid is not null`: this is what keeps logged-out visitors out of
-- post content in public circles.
create or replace function public.can_read_circle_content(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select uid is not null
     and (public.circle_is_public(cid) or public.is_circle_member(cid, uid));
$$;

create or replace function public.post_circle(pid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select circle_id from public.posts where id = pid;
$$;

create or replace function public.comment_circle(cmid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select p.circle_id
  from public.post_comments pc
  join public.posts p on p.id = pc.post_id
  where pc.id = cmid;
$$;

revoke all on function public.is_circle_member(uuid, uuid) from public;
revoke all on function public.circle_is_public(uuid) from public;
revoke all on function public.circle_is_visible(uuid, uuid) from public;
revoke all on function public.can_read_circle_content(uuid, uuid) from public;
revoke all on function public.post_circle(uuid) from public;
revoke all on function public.comment_circle(uuid) from public;
grant execute on function public.is_circle_member(uuid, uuid) to anon, authenticated;
grant execute on function public.circle_is_public(uuid) to anon, authenticated;
grant execute on function public.circle_is_visible(uuid, uuid) to anon, authenticated;
grant execute on function public.can_read_circle_content(uuid, uuid) to anon, authenticated;
grant execute on function public.post_circle(uuid) to anon, authenticated;
grant execute on function public.comment_circle(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Circle visibility. Replaced three policies that were a bare
-- `auth.role() = 'authenticated'` with no membership check — any signed-in
-- user could read every private circle, its members, and its schedule.
--
-- The pre-existing {anon} policies (circles: anon read public,
-- circle_members: anon count, circle_schedules: anon read) were already
-- correctly scoped to visibility = 'public' and are deliberately LEFT IN
-- PLACE. They are what makes logged-out previews work.
-- ---------------------------------------------------------------------------
drop policy if exists "circles: auth read" on public.circles;
create policy "circles: read public or own" on public.circles for select using (
  visibility = 'public'
  or created_by = auth.uid()
  or public.is_circle_member(id, auth.uid())
);

drop policy if exists "members: auth read" on public.circle_members;
create policy "members: read public or own" on public.circle_members for select using (
  user_id = auth.uid()
  or public.circle_is_visible(circle_id, auth.uid())
);

drop policy if exists "schedules: auth read" on public.circle_schedules;
create policy "schedules: read public or own" on public.circle_schedules for select using (
  public.circle_is_visible(circle_id, auth.uid())
);

-- events is empty and unused by the app, but carried the same unqualified
-- policy. Patched rather than dropped so the table survives for later.
drop policy if exists "events: auth read" on public.events;
create policy "events: read public or own" on public.events for select using (
  public.circle_is_visible(circle_id, auth.uid())
);


-- ---------------------------------------------------------------------------
-- Content. Public-circle branch now requires a signed-in user, so logged-out
-- visitors get the preview card but no posts, comments or likes.
-- ---------------------------------------------------------------------------
drop policy if exists "posts: members read" on public.posts;
create policy "posts: members read" on public.posts for select using (
  public.can_read_circle_content(circle_id, auth.uid())
);

drop policy if exists "post_comments: read" on public.post_comments;
create policy "post_comments: read" on public.post_comments for select using (
  public.can_read_circle_content(public.post_circle(post_id), auth.uid())
);

drop policy if exists "post_likes: read" on public.post_likes;
create policy "post_likes: read" on public.post_likes for select using (
  public.can_read_circle_content(public.post_circle(post_id), auth.uid())
);

drop policy if exists "comment_likes: read" on public.comment_likes;
create policy "comment_likes: read" on public.comment_likes for select using (
  public.can_read_circle_content(public.comment_circle(comment_id), auth.uid())
);


-- ---------------------------------------------------------------------------
-- Column-level grants.
--
-- IMPORTANT: `revoke select (col) ... from anon` alone does NOTHING while the
-- role still holds a table-level SELECT grant. You must revoke the table
-- grant and re-grant column by column. The first attempt used the column-only
-- form and silently had no effect.
-- ---------------------------------------------------------------------------

-- profiles: names/avatars/bios stay public (public member lists need them);
-- instagram handles no longer readable without an account.
revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url, created_at, bio) on public.profiles to anon;

-- circle_members: anon can COUNT members (the preview card shows a count) but
-- cannot see WHO they are, so the social graph can't be scraped or joined to
-- profiles. Requires the app to count with .select('circle_id', ...) rather
-- than .select('*', ...) — see src/app/circles/[id]/page.tsx.
revoke select on public.circle_members from anon;
grant select (circle_id) on public.circle_members to anon;


-- ---------------------------------------------------------------------------
-- circle_preview: lets a logged-out visitor (or a signed-in non-member) see
-- a preview card for a PRIVATE circle from a shared link. security definer,
-- so it returns preview columns only and deliberately omits latitude and
-- longitude.
--
-- Also fixes a pre-existing bug: anon could never read private circles, so a
-- shared private-circle link 404'd instead of rendering the preview card the
-- page was written to show.
-- ---------------------------------------------------------------------------
create or replace function public.circle_preview(circle_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  emoji text,
  category text,
  neighborhood text,
  location text,
  visibility text,
  member_count bigint,
  creator_name text
)
language sql security definer set search_path = public as $$
  select
    c.id, c.name, c.description, c.emoji, c.category,
    c.neighborhood, c.location, c.visibility,
    (select count(*) from public.circle_members m where m.circle_id = c.id),
    (select p.full_name from public.profiles p where p.id = c.created_by)
  from public.circles c
  where c.id = circle_preview.circle_id;
$$;

revoke all on function public.circle_preview(uuid) from public;
grant execute on function public.circle_preview(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Left ALONE, verified already correct:
--   messages              sender or recipient only
--   notifications         owner only
--   circle_join_requests  own rows, or circle admins
--   follows               any signed-in user (whole follow graph) — this is a
--                         product decision, not a bug. Tightening it would
--                         break follower counts on other people's profiles.
--   all INSERT/UPDATE/DELETE policies on every table — probed with bogus
--   foreign keys, every one returned 42501 (RLS refused).
-- ---------------------------------------------------------------------------
