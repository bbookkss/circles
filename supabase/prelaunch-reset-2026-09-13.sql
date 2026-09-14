-- Pre-launch data reset
-- ---------------------------------------------------------------------------
-- Clears the circles that exist only because somebody was testing, so the
-- first real visitor does not land in a graveyard of "test 2".
--
-- Deliberately NOT a truncate. The accounts stay, the real circles stay, and
-- the check-in and post history on the surviving circles stays, because that
-- history is the evidence those paths actually work. Only the fixtures go.
--
-- Everything cascades from `circles`. Verified against pg_constraint rather
-- than assumed: all eight children carry `on delete cascade` on circle_id, so
-- deleting the circle row is sufficient and there is no order to get wrong.
--
--   circle_members   circle_schedules   circle_check_ins   posts
--   events           circle_join_requests   notifications   email_reminder_sends
--
-- This also subsumes the reminder test fixture. That schedule lives on the
-- `test` circle, so it goes with it and needs no separate delete.
--
-- Run this in the Supabase dashboard SQL editor. Read the two SELECTs before
-- the COMMIT and roll back instead if the numbers are not what you expect.
-- ---------------------------------------------------------------------------

begin;

-- The list is explicit rather than a `name like 'test%'` pattern. A pattern
-- that quietly matches a real circle somebody made is exactly the mistake
-- this file exists to avoid, and there are only four.
create temporary table doomed on commit drop as
select id, name
  from public.circles
 where name in (
   'test',
   'test 2',
   'TEST Florida',
   'TEST Street autofill - tenderloin people watching'
 );

-- Expect 4 rows, named above. Anything else means the list drifted.
select 'about to delete' as step, count(*) as circles from doomed;

-- What goes with them, so the blast radius is visible before it happens
-- rather than inferred after.
select 'cascade preview' as step,
       (select count(*) from public.circle_members       where circle_id in (select id from doomed)) as members,
       (select count(*) from public.circle_schedules     where circle_id in (select id from doomed)) as schedules,
       (select count(*) from public.circle_check_ins     where circle_id in (select id from doomed)) as check_ins,
       (select count(*) from public.posts                where circle_id in (select id from doomed)) as posts,
       (select count(*) from public.events               where circle_id in (select id from doomed)) as events,
       (select count(*) from public.circle_join_requests where circle_id in (select id from doomed)) as join_requests,
       (select count(*) from public.notifications        where circle_id in (select id from doomed)) as notifications,
       (select count(*) from public.email_reminder_sends where circle_id in (select id from doomed)) as reminder_sends;

delete from public.circles where id in (select id from doomed);

-- Refuse to commit a reset that left the database in a shape nobody intended.
do $$
declare remaining int; orphan_sched int;
begin
  select count(*) into remaining from public.circles;
  if remaining <> 6 then
    raise exception 'expected 6 circles to survive, found %', remaining;
  end if;

  select count(*) into orphan_sched
    from public.circle_schedules s
   where not exists (select 1 from public.circles c where c.id = s.circle_id);
  if orphan_sched > 0 then
    raise exception '% orphaned schedule(s) left behind', orphan_sched;
  end if;
end $$;

select 'survivors' as step, name, visibility from public.circles order by created_at;

commit;
