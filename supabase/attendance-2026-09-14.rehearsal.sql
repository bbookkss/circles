-- Rehearsal for attendance-2026-09-14.sql. Rolled back; changes nothing.
--
-- Run it against production after applying the migration:
--
--   psql "$SUPABASE_DB_URL" -f supabase/attendance-2026-09-14.rehearsal.sql
--
-- It builds its own circle, schedule, members and check-ins, so it does not
-- depend on what happens to be in the database. Eight assertions, each
-- printing OK or FAILED:
--
--   T1  a member can file the register for a finished meet
--   T2  the ratio counts yes-and-came against yes-and-confirmed
--   T3  a non-member cannot file it
--   T4  a meet that has not happened cannot be confirmed
--   T5  a direct INSERT, bypassing the function, is refused
--   T6  somebody who never said yes cannot be marked either way
--   T7  re-filing amends in place rather than duplicating
--   T8  circle_last_meet finds the right occurrence
-- Behaviour rehearsal. Everything synthetic, rolled back at the end.
begin;

select
  (select id from public.profiles order by created_at limit 1)::text          as admin_id,
  (select id from public.profiles order by created_at offset 1 limit 1)::text as member_id,
  (current_date - 1)::text                                                    as past_meet,
  (current_date + 1)::text                                                    as future_meet,
  'dddddddd-0000-0000-0000-00000000000f'                                      as circle_id
\gset

-- A circle that meets every day at 10, anchored a month back, so yesterday is
-- a finished occurrence and tomorrow is a future one.
insert into public.circles (id, name, visibility, kind, created_by, timezone)
values (:'circle_id', 'Rehearsal', 'private', 'social', :'admin_id', 'America/New_York');
insert into public.circle_schedules (circle_id, days_of_week, start_time, end_time, frequency, starts_on)
values (:'circle_id', '{0,1,2,3,4,5,6}', '10:00', '11:00', 'weekly', current_date - 30);
insert into public.circle_members (circle_id, user_id, role) values
  (:'circle_id', :'admin_id', 'admin'),
  (:'circle_id', :'member_id', 'member');

-- Both said yes to yesterday. The check-in trigger refuses past dates, which
-- is right in the app and in the way here.
alter table public.circle_check_ins disable trigger circle_check_ins_guard;
insert into public.circle_check_ins (circle_id, user_id, occurs_on, status) values
  (:'circle_id', :'admin_id',  :'past_meet', 'yes'),
  (:'circle_id', :'member_id', :'past_meet', 'yes');
alter table public.circle_check_ins enable trigger circle_check_ins_guard;

-- psql's :vars are not substituted inside $$ ... $$, so the DO blocks below
-- read the fixture out of session settings instead.
select set_config('rz.circle', :'circle_id', true),
       set_config('rz.admin',  :'admin_id',  true),
       set_config('rz.member', :'member_id', true),
       set_config('rz.past',   :'past_meet', true),
       set_config('rz.future', :'future_meet', true);

-- T1: a member files the register. One came, one did not.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role','authenticated')::text, true);
do $$ begin
  perform public.record_attendance(current_setting('rz.circle')::uuid, current_setting('rz.past')::date, array[current_setting('rz.admin')::uuid], array[current_setting('rz.member')::uuid]);
  raise notice 'T1 OK: member filed the register';
exception when others then raise notice 'T1 FAILED: %', sqlerrm; end $$;
reset role;

select 'T1' as step, attended, count(*) from public.circle_attendance group by attended order by 1;

-- T2: 1 of 1 for the one who came, 0 of 1 for the one who did not.
select 'T2' as step, p.full_name, r.committed, r.attended
from public.reliability(array[:'admin_id'::uuid, :'member_id'::uuid]) r
join public.profiles p on p.id = r.user_id
order by p.full_name;

-- T3: an outsider cannot file it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
do $$ begin
  perform public.record_attendance(current_setting('rz.circle')::uuid, current_setting('rz.past')::date, array[current_setting('rz.admin')::uuid], '{}'::uuid[]);
  raise notice 'T3 FAILED: outsider filed the register';
exception when others then raise notice 'T3 OK: outsider blocked -> %', sqlerrm; end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role','authenticated')::text, true);

-- T4: a meet that has not happened cannot be confirmed.
do $$ begin
  perform public.record_attendance(current_setting('rz.circle')::uuid, current_setting('rz.future')::date, array[current_setting('rz.admin')::uuid], '{}'::uuid[]);
  raise notice 'T4 FAILED: confirmed a meet that has not happened';
exception when others then raise notice 'T4 OK: future meet blocked -> %', sqlerrm; end $$;

-- T5: a direct write, bypassing the function, is refused.
do $$ begin
  insert into public.circle_attendance (circle_id, user_id, occurs_on, attended)
  values (current_setting('rz.circle')::uuid, current_setting('rz.admin')::uuid, current_setting('rz.past')::date, true);
  raise notice 'T5 FAILED: direct insert succeeded';
exception when others then raise notice 'T5 OK: direct insert blocked -> %', sqlerrm; end $$;

-- T6: somebody who never answered cannot be marked either way.
do $$ declare n int; begin
  perform public.record_attendance(current_setting('rz.circle')::uuid, current_setting('rz.past')::date, array['00000000-0000-0000-0000-0000000000ff'::uuid], '{}'::uuid[]);
  select count(*) into n from public.circle_attendance where user_id = '00000000-0000-0000-0000-0000000000ff';
  if n = 0 then raise notice 'T6 OK: non-attendee skipped, no row written';
  else raise notice 'T6 FAILED: wrote % row(s) for someone who never checked in', n; end if;
end $$;

-- T7: re-filing amends rather than duplicating.
do $$ declare n int; a boolean; begin
  perform public.record_attendance(current_setting('rz.circle')::uuid, current_setting('rz.past')::date, array[current_setting('rz.member')::uuid], '{}'::uuid[]);
  select count(*), bool_and(attended) into n, a
    from public.circle_attendance where user_id = current_setting('rz.member')::uuid;
  if n = 1 and a then raise notice 'T7 OK: amended in place, now marked present';
  else raise notice 'T7 FAILED: % row(s), attended=%', n, a; end if;
end $$;
reset role;

-- T8: circle_last_meet points at yesterday.
select 'T8' as step, public.circle_last_meet(:'circle_id') = :'past_meet'::date as matches;

rollback;
