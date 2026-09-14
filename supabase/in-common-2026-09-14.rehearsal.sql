-- Rehearsal for in-common-2026-09-14.sql. Rolled back; changes nothing.
--
--   psql "$SUPABASE_DB_URL" -f supabase/in-common-2026-09-14.rehearsal.sql
--
-- The shape it builds, from the viewer's point of view:
--
--   X  public   me + them                 -> the shared circle
--   Y  public   me + mutual + leaker      -> both share a circle with me
--   Z  public   them + mutual             -> mutual's second leg, visible
--   S  private  them + leaker   (me NOT in)  -> leaker's second leg, hidden
--
-- So `mutual` should come back and `leaker` must not. Leaker is the whole
-- point of the fixture: they satisfy the naive definition of a mutual in
-- every respect, and the only thing disqualifying them is that the circle
-- joining them to `them` is one the viewer has no right to see. Getting this
-- wrong would turn a friendly "you both know Sam" into a private-roster leak.
begin;

select
  (select id from public.profiles order by created_at limit 1)::text          as me,
  (select id from public.profiles order by created_at offset 1 limit 1)::text as them,
  (select id from public.profiles order by created_at offset 2 limit 1)::text as mutual,
  (select id from public.profiles order by created_at offset 3 limit 1)::text as leaker,
  'eeee0000-0000-0000-0000-0000000000' || 'aa'                                as cx,
  'eeee0000-0000-0000-0000-0000000000' || 'bb'                                as cy,
  'eeee0000-0000-0000-0000-0000000000' || 'cc'                                as cz,
  'eeee0000-0000-0000-0000-0000000000' || 'dd'                                as cs
\gset

insert into public.circles (id, name, visibility, kind, created_by, timezone) values
  (:'cx', 'Rehearsal X', 'public',  'social', :'me',   'America/New_York'),
  (:'cy', 'Rehearsal Y', 'public',  'social', :'me',   'America/New_York'),
  (:'cz', 'Rehearsal Z', 'public',  'social', :'them', 'America/New_York'),
  (:'cs', 'Rehearsal S', 'private', 'social', :'them', 'America/New_York');

insert into public.circle_members (circle_id, user_id, role) values
  (:'cx', :'me', 'admin'),     (:'cx', :'them', 'member'),
  (:'cy', :'me', 'admin'),     (:'cy', :'mutual', 'member'), (:'cy', :'leaker', 'member'),
  (:'cz', :'them', 'admin'),   (:'cz', :'mutual', 'member'),
  (:'cs', :'them', 'admin'),   (:'cs', :'leaker', 'member');

-- psql's :vars are not substituted inside $$ ... $$, so the DO blocks read
-- the fixture out of session settings instead.
select set_config('rz.me', :'me', true),
       set_config('rz.them', :'them', true),
       set_config('rz.mutual', :'mutual', true),
       set_config('rz.leaker', :'leaker', true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'me', 'role','authenticated')::text, true);

-- T1: exactly the one circle we are both in.
select 'T1' as step, c.name as shared_circle
from public.shared_circles(:'them'::uuid) sc join public.circles c on c.id = sc;

-- T2: mutual is returned, leaker is not.
select 'T2' as step, p.full_name as mutual
from public.mutual_members(:'them'::uuid) m join public.profiles p on p.id = m
order by p.full_name;

do $$
declare got uuid[];
begin
  select array_agg(m order by m) into got from public.mutual_members(current_setting('rz.them')::uuid) m;
  if got is distinct from array[current_setting('rz.mutual')::uuid] then
    raise notice 'T2 FAILED: expected only the mutual, got %', got;
  else
    raise notice 'T2 OK: mutual returned, private-circle leaker excluded';
  end if;
end $$;

-- T3: pointing it at yourself returns nothing rather than everyone.
do $$
declare n int;
begin
  select count(*) into n from public.mutual_members(auth.uid());
  if n = 0 then raise notice 'T3 OK: self returns no mutuals';
  else raise notice 'T3 FAILED: self returned % rows', n; end if;
  select count(*) into n from public.shared_circles(auth.uid());
  if n = 0 then raise notice 'T3 OK: self returns no shared circles';
  else raise notice 'T3 FAILED: self returned % circles', n; end if;
end $$;

-- T4: member_stats answers for everyone asked, including zeroes.
select 'T4' as step, p.full_name, s.meets_attended, s.committed, s.kept
from public.member_stats(array[current_setting('rz.me')::uuid, current_setting('rz.them')::uuid]) s
join public.profiles p on p.id = s.user_id
order by p.full_name;

reset role;
rollback;
