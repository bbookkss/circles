-- Narrow execute on the mutating security definer functions
-- ---------------------------------------------------------------------------
-- Defence in depth, not a fix for a live hole. Applying this changes no
-- behaviour that anyone can observe today; skipping it costs nothing today
-- either. It is here so the grants say what the code already enforces.
--
-- Supabase's default privileges grant EXECUTE on every new function in public
-- to `anon` and `authenticated` by name. `revoke all on function ... from
-- public` does not touch a named grant, so cohosts-2026-09-29's revoke read as
-- exclusive and was not: `anon` kept execute on set_member_role. The same is
-- true of all 22 security definer functions in public.
--
-- The three below are the ones that write. Each already opens with
--   if auth.uid() is null then raise ... insufficient_privilege
-- and each was probed anonymously through PostgREST on 2026-09-29, returning
-- 42501 not authenticated. This makes the grant agree with that guard, so a
-- future edit that drops the guard is not silently reachable by anon.
--
-- The readers are left alone deliberately. They take a viewer id and answer
-- about that viewer, so an anon caller learns nothing it could not reach
-- through PostgREST already, and several are called from RLS policies where a
-- narrowed grant is a good way to break reads in a hard-to-diagnose way.

begin;

revoke execute on function public.set_member_role(uuid, uuid, text)  from anon;
revoke execute on function public.approve_join_request(uuid, uuid)   from anon;
revoke execute on function public.record_attendance(uuid, date, uuid[], uuid[]) from anon;

do $$
declare
  leaked text;
begin
  select string_agg(p.proname, ', ')
    into leaked
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('set_member_role', 'approve_join_request', 'record_attendance')
     and array_to_string(p.proacl, ' ') like '%anon=X%';
  if leaked is not null then
    raise exception 'anon still holds execute on: %', leaked;
  end if;

  -- The grant these must keep. Losing it breaks the app outright.
  select string_agg(p.proname, ', ')
    into leaked
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('set_member_role', 'approve_join_request', 'record_attendance')
     and array_to_string(p.proacl, ' ') not like '%authenticated=X%';
  if leaked is not null then
    raise exception 'authenticated lost execute on: %', leaked;
  end if;
end $$;

commit;
