-- Rehearsal for cohosts-2026-09-29.sql. Rolled back; changes nothing.
--
--   psql "$SUPABASE_DB_URL" -f supabase/cohosts-2026-09-29.rehearsal.sql
--
--   T1  an admin promotes a member
--   T2  an admin demotes a co-admin
--   T3  a plain member cannot promote anybody, including themselves
--   T4  an outsider cannot
--   T5  the last admin cannot demote themselves and strand the circle
--   T6  somebody who is not in the circle cannot be given a role in it
--   T7  a nonsense role is refused
begin;

select
  (select id from public.profiles order by created_at limit 1)::text          as admin,
  (select id from public.profiles order by created_at offset 1 limit 1)::text as member,
  (select id from public.profiles order by created_at offset 2 limit 1)::text as outsider,
  'cccc0000-0000-0000-0000-00000000000a'                                      as circle
\gset

insert into public.circles (id, name, visibility, kind, created_by, timezone)
values (:'circle', 'Cohost rehearsal', 'public', 'social', :'admin', 'America/New_York');
insert into public.circle_members (circle_id, user_id, role) values
  (:'circle', :'admin', 'admin'),
  (:'circle', :'member', 'member');

select set_config('rz.circle', :'circle', true),
       set_config('rz.admin', :'admin', true),
       set_config('rz.member', :'member', true),
       set_config('rz.outsider', :'outsider', true);

-- T1: admin promotes the member.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role','authenticated')::text, true);
do $$ declare r text; begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.member')::uuid, 'admin');
  select role into r from public.circle_members
   where circle_id = current_setting('rz.circle')::uuid and user_id = current_setting('rz.member')::uuid;
  if r = 'admin' then raise notice 'T1 OK: member promoted to admin';
  else raise notice 'T1 FAILED: role is %', r; end if;
exception when others then raise notice 'T1 FAILED: %', sqlerrm; end $$;

-- T2: and demotes them again, now that there are two admins.
do $$ declare r text; begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.member')::uuid, 'member');
  select role into r from public.circle_members
   where circle_id = current_setting('rz.circle')::uuid and user_id = current_setting('rz.member')::uuid;
  if r = 'member' then raise notice 'T2 OK: demoted back to member';
  else raise notice 'T2 FAILED: role is %', r; end if;
exception when others then raise notice 'T2 FAILED: %', sqlerrm; end $$;

-- T5: the sole admin cannot demote themselves.
do $$ begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.admin')::uuid, 'member');
  raise notice 'T5 FAILED: last admin demoted themselves';
exception when others then raise notice 'T5 OK: blocked -> %', sqlerrm; end $$;

-- T6: somebody outside the circle cannot be given a role in it.
do $$ begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.outsider')::uuid, 'admin');
  raise notice 'T6 FAILED: gave a role to a non-member';
exception when others then raise notice 'T6 OK: blocked -> %', sqlerrm; end $$;

-- T7: a role that is not a role.
do $$ begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.member')::uuid, 'owner');
  raise notice 'T7 FAILED: accepted a bogus role';
exception when others then raise notice 'T7 OK: blocked -> %', sqlerrm; end $$;
reset role;

-- T3: a plain member cannot promote themselves.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'member', 'role','authenticated')::text, true);
do $$ begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.member')::uuid, 'admin');
  raise notice 'T3 FAILED: member promoted themselves';
exception when others then raise notice 'T3 OK: blocked -> %', sqlerrm; end $$;
reset role;

-- T4: an outsider cannot either.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'outsider', 'role','authenticated')::text, true);
do $$ begin
  perform public.set_member_role(current_setting('rz.circle')::uuid, current_setting('rz.member')::uuid, 'admin');
  raise notice 'T4 FAILED: outsider changed a role';
exception when others then raise notice 'T4 OK: blocked -> %', sqlerrm; end $$;
reset role;

rollback;
