-- What you have in common with someone
-- ---------------------------------------------------------------------------
-- Partiful puts two things on a profile that Circles was missing: how many
-- gatherings a person has actually been to, and who you both know. The first
-- says whether somebody is a regular. The second is the thing that makes a
-- stranger worth meeting, because "you both know Sam" is the difference
-- between turning up to a room of strangers and turning up to a room with a
-- way in.
--
-- Recurrence makes both stronger here than they are at Partiful. A count of
-- parties is a count of nights out; a count of meets is a count of times
-- somebody came back.
--
-- Three functions:
--
--   member_stats    replaces reliability(), adding a total. Aggregate only.
--   shared_circles  circles you and they are both in.
--   mutual_members  people you both know, computed so it can never surface a
--                   membership the viewer could not already look up.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- member_stats: how much they show up, and how often they have shown up
--
-- Replaces reliability(), which returned two of these three. The return type
-- changes, so the old one has to go rather than be replaced in place.
--
--   meets_attended  every meet they were confirmed present at, ever. Tenure.
--   committed       meets they said yes to that somebody later confirmed.
--   kept            of those, the ones they turned up to.
--
-- meets_attended counts presence however it was reached, including the person
-- who said no and came anyway, because turning up is turning up. committed
-- and kept count only promises, because that is what reliability means.
--
-- Security definer, as before: the numbers span circles the viewer cannot
-- see, and three integers say how much somebody shows up without saying where.
-- ---------------------------------------------------------------------------
drop function if exists public.reliability(uuid[]);

create or replace function public.member_stats(uids uuid[])
returns table (user_id uuid, meets_attended int, committed int, kept int)
language sql stable security definer
set search_path = public
as $$
  select
    u.uid,
    (select count(*)::int
       from public.circle_attendance a
      where a.user_id = u.uid and a.attended),
    (select count(*)::int
       from public.circle_attendance a
       join public.circle_check_ins ci
         on ci.circle_id = a.circle_id and ci.user_id = a.user_id and ci.occurs_on = a.occurs_on
      where a.user_id = u.uid and ci.status = 'yes'),
    (select count(*)::int
       from public.circle_attendance a
       join public.circle_check_ins ci
         on ci.circle_id = a.circle_id and ci.user_id = a.user_id and ci.occurs_on = a.occurs_on
      where a.user_id = u.uid and ci.status = 'yes' and a.attended)
  from unnest(uids) as u(uid);
$$;
revoke all on function public.member_stats(uuid[]) from public;
grant execute on function public.member_stats(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- shared_circles: circles you are both in
--
-- Takes only the other person, never the viewer, so it cannot be pointed at
-- two strangers to learn about them. The viewer is a member of everything it
-- returns by definition, so there is nothing here they could not already see.
-- ---------------------------------------------------------------------------
create or replace function public.shared_circles(p_other uuid)
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select m.circle_id
  from public.circle_members m
  join public.circle_members o on o.circle_id = m.circle_id and o.user_id = p_other
  where m.user_id = auth.uid()
    and p_other <> auth.uid();
$$;
revoke all on function public.shared_circles(uuid) from public;
grant execute on function public.shared_circles(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mutual_members: people you both know
--
-- A mutual is somebody who shares a circle with the viewer and shares a
-- circle with the other person. The first leg is safe automatically, since
-- the viewer is in that circle. The second leg is the one that needs care: it
-- must not reveal that two people share a *private* circle the viewer has no
-- business seeing.
--
-- So the second leg only counts through a circle that is public, or one the
-- viewer is also in. Everything this returns, the viewer could have worked
-- out by opening two pages they already have access to. It is a shortcut,
-- not a new disclosure.
-- ---------------------------------------------------------------------------
create or replace function public.mutual_members(p_other uuid)
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select distinct mine.user_id
  from public.circle_members mine
  join public.circle_members me
    on me.circle_id = mine.circle_id and me.user_id = auth.uid()
  where p_other <> auth.uid()
    and mine.user_id <> auth.uid()
    and mine.user_id <> p_other
    and exists (
      select 1
      from public.circle_members theirs
      join public.circles c on c.id = theirs.circle_id
      join public.circle_members other on other.circle_id = theirs.circle_id and other.user_id = p_other
      where theirs.user_id = mine.user_id
        and (c.visibility = 'public' or public.is_circle_member(c.id, auth.uid()))
    );
$$;
revoke all on function public.mutual_members(uuid) from public;
grant execute on function public.mutual_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'reliability') then
    raise exception 'reliability() survived; member_stats replaces it';
  end if;
  if not exists (select 1 from pg_proc where proname = 'member_stats') then
    raise exception 'member_stats missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'shared_circles') then
    raise exception 'shared_circles missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'mutual_members') then
    raise exception 'mutual_members missing';
  end if;
end $$;

commit;
