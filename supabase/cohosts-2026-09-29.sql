-- Cohosts: an admin can promote someone else
-- ---------------------------------------------------------------------------
-- Taken from Partiful, which puts "Add cohosts" on the event form. It is the
-- one thing on that form worth having here, and for a reason bigger than
-- parity: the failure mode that kills a recurring group is the organiser
-- getting tired, and a circle with exactly one admin has no answer to that.
--
-- It also closes a dead end. `leaveCircle` refuses a sole admin with "Make
-- someone else an admin before you leave", and until now there was no way
-- anywhere in the app to do that. The only UPDATE privilege `authenticated`
-- holds on circle_members is the single column `email_reminders`, which is
-- correct and is why this needs a function rather than a policy.
--
-- Security definer because an admin is writing somebody else's row, which no
-- sane UPDATE policy should allow directly. Everything the caller could get
-- wrong is checked here.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.set_member_role(
  p_circle uuid,
  p_user   uuid,
  p_role   text
)
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
  if p_role not in ('admin', 'member') then
    raise exception 'role must be admin or member' using errcode = 'check_violation';
  end if;
  if not public.is_circle_admin(p_circle, me) then
    raise exception 'only an admin of this circle can change roles'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.is_circle_member(p_circle, p_user) then
    raise exception 'that person is not in this circle'
      using errcode = 'no_data_found';
  end if;

  -- The whole point is to stop a circle being stranded, so it must not be the
  -- thing that strands one. Demoting the last admin is refused, including an
  -- admin demoting themselves, which is the likeliest way to do it by accident.
  if p_role = 'member' and not exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle and m.role = 'admin' and m.user_id <> p_user
  ) then
    raise exception 'a circle needs at least one admin'
      using errcode = 'check_violation';
  end if;

  update public.circle_members
     set role = p_role
   where circle_id = p_circle and user_id = p_user;
end;
$$;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_member_role') then
    raise exception 'set_member_role missing';
  end if;
  -- If this ever becomes a plain column grant, the function is pointless.
  if exists (
    select 1 from information_schema.column_privileges
    where table_name = 'circle_members' and column_name = 'role'
      and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
  ) then
    raise exception 'circle_members.role is directly updatable; it should not be';
  end if;
end $$;

commit;
