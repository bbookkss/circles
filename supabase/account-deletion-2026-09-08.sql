-- ---------------------------------------------------------------------------
-- Account deletion — 2026-09-08
--
-- Lets a signed-in user delete their own account. Two product decisions are
-- baked in here:
--
--   1. Posts and comments SURVIVE their author, shown as "Deleted user".
--      Everything else the person owns (memberships, likes, follows, DMs,
--      notifications, join requests) is destroyed by the existing cascades.
--
--   2. A circle whose only admin leaves is handed to its longest-standing
--      remaining member. A circle with no members left is deleted.
--
-- Deliberately NOT using the service_role key. A security-definer function
-- keeps that key out of the app entirely: the only privileged thing the web
-- tier can do is "delete the caller's own account", not "delete any user".
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Let authorship go null, so content outlives its author.
--
-- posts.user_id and post_comments.user_id are NOT NULL and CASCADE today,
-- which is why deleting a profile currently takes the person's posts with it.
-- ---------------------------------------------------------------------------
alter table public.posts          alter column user_id drop not null;
alter table public.post_comments  alter column user_id drop not null;

alter table public.posts drop constraint if exists posts_user_id_fkey;
alter table public.posts add constraint posts_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.post_comments drop constraint if exists post_comments_user_id_fkey;
alter table public.post_comments add constraint post_comments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Note: the write policies on both tables are `auth.uid() = user_id`. With a
-- null user_id that test is null, never true, so an anonymised post becomes
-- uneditable and undeletable by everyone. That is the intended outcome.


-- ---------------------------------------------------------------------------
-- 2. delete_own_account()
--
-- Runs as the function owner so it can reach auth.users, but derives its
-- target solely from auth.uid() — it cannot be pointed at anyone else.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  c    record;
  heir uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  -- Walk every circle the caller belongs to, in any role.
  for c in
    select circle_id, role
    from public.circle_members
    where user_id = me
  loop
    -- Last one out deletes the circle. This also cleans up the circles that
    -- currently have no admin at all, where the caller is the only member.
    if not exists (
      select 1 from public.circle_members
      where circle_id = c.circle_id and user_id <> me
    ) then
      delete from public.circles where id = c.circle_id;
      continue;
    end if;

    -- Others remain. Only intervene if the caller is the last admin.
    if c.role = 'admin' and not exists (
      select 1 from public.circle_members
      where circle_id = c.circle_id and user_id <> me and role = 'admin'
    ) then
      select user_id into heir
      from public.circle_members
      where circle_id = c.circle_id and user_id <> me
      order by joined_at asc nulls last, user_id asc
      limit 1;

      update public.circle_members
      set role = 'admin'
      where circle_id = c.circle_id and user_id = heir;
    end if;
  end loop;

  -- Cascades from here: profiles, and from profiles every table that
  -- references it. posts and post_comments go null instead of vanishing.
  delete from auth.users where id = me;
end;
$$;

-- Callable only by a signed-in user, and only against themselves.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
