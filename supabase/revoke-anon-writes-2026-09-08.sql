-- ---------------------------------------------------------------------------
-- Revoke anon's write privileges — 2026-09-08
--
-- Supabase grants broadly to anon and relies on RLS to hold the line. That is
-- stock posture, and today it works: every anon write is refused because
-- auth.uid() is null, so "own row" policies match nothing. Probed directly —
-- zero rows changed.
--
-- Two reasons to take the privileges away anyway:
--
--   1. TRUNCATE is not subject to RLS at all. Nothing can reach it through
--      PostgREST, which never emits TRUNCATE, but the grant is real and the
--      only thing standing between it and the data is the API surface.
--   2. Everything else is one permissive policy away from becoming live. A
--      future "anon can insert X" policy silently carries write access to
--      every column of that table, including is_business.
--
-- anon needs SELECT and nothing else. The app performs no anonymous writes:
-- signup goes through GoTrue, and the profile row is created by
-- handle_new_user, which is security definer and runs as its owner.
--
-- SELECT is deliberately untouched, including the column-level grants on
-- profiles and circle_members that the logged-out circle page depends on.
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon',
      t.tablename
    );
  end loop;
end $$;
