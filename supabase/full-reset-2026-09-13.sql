-- Full pre-launch reset: empty the app, keep one account
-- ---------------------------------------------------------------------------
-- Deletes every circle and every account except Ben's, so pilot users arrive
-- at an empty product rather than a museum of someone else's testing.
--
-- This REPLACES supabase/prelaunch-reset-2026-09-13.sql, which removed only
-- the four obvious fixture circles. Do not run both. This file is a superset.
--
-- Destructive and not recoverable. Supabase's point-in-time restore is the
-- only undo, and on the free plan there isn't one. Read the previews, then
-- decide whether to COMMIT or ROLLBACK at the bottom. The file deliberately
-- ends in ROLLBACK: change that one word to `commit;` when you have looked at
-- the numbers and they are what you expect.
--
-- ---------------------------------------------------------------------------
-- Order matters, for one non-obvious reason
-- ---------------------------------------------------------------------------
-- Most foreign keys here cascade, but two do not:
--
--   circles.created_by  ->  profiles(id)   ON DELETE SET NULL
--   posts.user_id       ->  profiles(id)   ON DELETE SET NULL
--
-- That is correct behaviour for account deletion, where a departed person's
-- circles should survive and their posts should go anonymous rather than
-- vanish. It is the wrong behaviour here. Deleting the account first would
-- leave that account's circles standing with `created_by = null`, owned by
-- nobody and impossible to administer.
--
-- So: circles first, then the account. Everything else follows by cascade.
--
-- ---------------------------------------------------------------------------
-- What cascades, verified against pg_constraint rather than assumed
-- ---------------------------------------------------------------------------
--   circles  -> circle_members, circle_schedules, circle_check_ins, posts,
--               events, circle_join_requests, notifications,
--               email_reminder_sends
--   posts    -> post_likes, post_comments, notifications
--   post_comments -> comment_likes, notifications
--   auth.users -> profiles -> follows, messages, post_likes, comment_likes,
--               business_requests, platform_admins, circle_members, ...
--
-- ---------------------------------------------------------------------------
-- What is deliberately kept
-- ---------------------------------------------------------------------------
--   * Ben's auth.users row, profile, and platform_admins row. Losing the
--     platform_admins row would lock him out of /admin with no way back in
--     through the UI, so it is asserted at the end.
--   * email_suppressions. It is keyed by email address, not by user, and it
--     is the record of who asked never to be emailed again. That request
--     outlives the account, the circle, and this reset. Deleting it would
--     mean mailing someone who opted out, which is the one failure here with
--     a legal dimension. Currently empty; kept anyway, on principle.
-- ---------------------------------------------------------------------------

begin;

-- Ben's id, resolved by email so a copy-pasted UUID cannot silently target
-- the wrong row.
create temporary table keeper on commit drop as
select id from auth.users where email = 'benjaminabookstaver@gmail.com';

do $$
begin
  if (select count(*) from keeper) <> 1 then
    raise exception 'expected exactly 1 account to keep, found %',
      (select count(*) from keeper);
  end if;
end $$;

select 'keeping' as step, u.email, p.full_name
  from keeper k join auth.users u on u.id = k.id
  left join public.profiles p on p.id = k.id;

select 'deleting accounts' as step, u.email
  from auth.users u where u.id not in (select id from keeper);

select 'deleting circles' as step, count(*) as circles from public.circles;

select 'cascade preview' as step,
       (select count(*) from public.circle_members)       as members,
       (select count(*) from public.circle_schedules)     as schedules,
       (select count(*) from public.circle_check_ins)     as check_ins,
       (select count(*) from public.posts)                as posts,
       (select count(*) from public.post_comments)        as comments,
       (select count(*) from public.post_likes)           as post_likes,
       (select count(*) from public.comment_likes)        as comment_likes,
       (select count(*) from public.email_reminder_sends) as reminder_sends;

-- 1. Circles first, for the SET NULL reason explained above.
delete from public.circles;

-- 2. Then every account that is not the keeper. Cascades through profiles.
delete from auth.users where id not in (select id from keeper);

-- 3. Anything left that is keyed by neither, and so cascades from nothing.
--    email_suppressions is excluded on purpose; see the header.
delete from public.follows;
delete from public.messages;
delete from public.notifications;
delete from public.business_requests;

-- ---------------------------------------------------------------------------
-- Post-conditions. Any failure rolls the whole thing back rather than leaving
-- the database half-reset, which is worse than not having started.
-- ---------------------------------------------------------------------------
do $$
declare n int; ben uuid;
begin
  select id into ben from keeper;

  select count(*) into n from auth.users;
  if n <> 1 then raise exception 'expected 1 account, found %', n; end if;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'expected 1 profile, found %', n; end if;

  select count(*) into n from public.profiles where id = ben;
  if n <> 1 then raise exception 'the surviving profile is not Ben'; end if;

  -- Losing this silently would lock him out of /admin.
  select count(*) into n from public.platform_admins where user_id = ben;
  if n <> 1 then raise exception 'Ben is no longer a platform admin'; end if;

  select count(*) into n from public.circles;
  if n <> 0 then raise exception 'expected 0 circles, found %', n; end if;

  -- Nothing should be left pointing at a circle or account that is gone.
  select (select count(*) from public.circle_members)
       + (select count(*) from public.circle_schedules)
       + (select count(*) from public.circle_check_ins)
       + (select count(*) from public.posts)
       + (select count(*) from public.post_comments)
       + (select count(*) from public.post_likes)
       + (select count(*) from public.comment_likes)
       + (select count(*) from public.events)
       + (select count(*) from public.circle_join_requests)
       + (select count(*) from public.email_reminder_sends)
    into n;
  if n <> 0 then raise exception '% orphaned child row(s) survived', n; end if;
end $$;

select 'final' as step,
       (select count(*) from auth.users)            as accounts,
       (select count(*) from public.profiles)       as profiles,
       (select count(*) from public.circles)        as circles,
       (select count(*) from public.platform_admins) as admins,
       (select count(*) from public.email_suppressions) as suppressions_kept;

-- ---------------------------------------------------------------------------
-- Change to `commit;` when the numbers above are what you expect.
-- ---------------------------------------------------------------------------
rollback;
