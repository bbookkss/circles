-- ---------------------------------------------------------------------------
-- Member counts in one round trip — 2026-09-09
--
-- /explore counted members with one query per circle: seven circles, seven
-- queries, and each Supabase call costs 130-180ms. That is invisible today and
-- ruinous at two hundred circles, which is the whole point of an explore page.
--
-- Deliberately NOT security definer. SELECT on circle_members is governed by
-- two permissive policies -- anyone may count members of a public circle, and
-- you may always see your own rows -- so the existing per-circle counts are
-- already RLS-filtered. Running as invoker keeps the numbers identical rather
-- than quietly revealing membership of private circles.
--
-- Circles with no members simply do not appear in the result; the caller
-- defaults them to zero, exactly as the previous code did.
-- ---------------------------------------------------------------------------

create or replace function public.circle_member_counts(cids uuid[])
returns table (circle_id uuid, member_count bigint)
language sql
stable
set search_path = public
as $$
  select m.circle_id, count(*)::bigint as member_count
  from public.circle_members m
  where m.circle_id = any(cids)
  group by m.circle_id;
$$;

revoke all on function public.circle_member_counts(uuid[]) from public;
grant execute on function public.circle_member_counts(uuid[]) to anon, authenticated;
