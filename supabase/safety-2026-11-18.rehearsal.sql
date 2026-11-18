-- Rehearsal for safety-2026-11-18.sql. Rolled back; changes nothing.
--
--   psql "$SUPABASE_DB_URL" -f supabase/safety-2026-11-18.rehearsal.sql
--
-- Refusals must be 42501 (RLS or a missing grant) to count as OK; any other
-- error prints FAILED with its message. A top-level psql ERROR aborts the
-- transaction and silences every later line, so read for those too.
--
-- Needs a platform admin plus two other profiles, `a` and `b`. Builds a
-- private circle with both of them in it, a post from each, and a message
-- from b to a. Each test prints OK or FAILED:
--
--   B1  blocking removes follows in both directions
--   B2  the blocked person cannot follow back
--   B3  ...or message, even holding a follow
--   B4  the conversation is hidden from both sides
--   B5  each side stops seeing the other's posts in a shared circle
--   B6  the blocked person cannot see the block
--   B7  nobody can insert a block directly
--   B8  the blocked person cannot send a notification
--   B9  unblocking brings the posts back
--   B10 the blocked person cannot comment on the blocker's post
--   B11 blocked_with() is not an RPC: nobody can ask who blocked them
--   R1  a member can report a post; the snapshot is the post
--   R2  reporting again updates the open report instead of adding one,
--       and says it is not new (so no second email)
--   R3  someone outside a private circle cannot report what is in it
--   R4  a non-admin cannot read reports
--   R5  ...or resolve them
--   R6  a platform admin can read the report
--   R7  'remove' deletes the post and closes the report
--   R8  nobody can report themselves
--   R9  a report on a person captures the messages they sent the reporter
--   R10 nobody can insert a report directly
begin;

select
  (select user_id from public.platform_admins limit 1)::text as admin,
  (select id from public.profiles where id not in (select user_id from public.platform_admins)
    order by created_at limit 1)::text as a,
  (select id from public.profiles where id not in (select user_id from public.platform_admins)
    order by created_at offset 1 limit 1)::text as b,
  'bbbb0000-0000-0000-0000-00000000000c' as circle,
  'bbbb0000-0000-0000-0000-0000000000a1' as post_a,
  'bbbb0000-0000-0000-0000-0000000000b1' as post_b
\gset

insert into public.circles (id, name, visibility, kind, created_by, timezone)
values (:'circle', 'Safety rehearsal', 'private', 'social', :'a', 'America/Los_Angeles');
insert into public.circle_members (circle_id, user_id, role) values
  (:'circle', :'a', 'admin'),
  (:'circle', :'b', 'member');
insert into public.posts (id, circle_id, user_id, content) values
  (:'post_a', :'circle', :'a', 'post from a'),
  (:'post_b', :'circle', :'b', 'post from b');
insert into public.messages (sender_id, recipient_id, content) values (:'b', :'a', 'see you there');
insert into public.follows (follower_id, following_id) values (:'a', :'b'), (:'b', :'a')
  on conflict do nothing;

select set_config('rz.admin', :'admin', true),
       set_config('rz.a', :'a', true),
       set_config('rz.b', :'b', true),
       set_config('rz.circle', :'circle', true),
       set_config('rz.post_a', :'post_a', true),
       set_config('rz.post_b', :'post_b', true);

-- B1
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'a', 'role','authenticated')::text, true);
select public.block_user(:'b');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.follows
   where (follower_id = current_setting('rz.a')::uuid and following_id = current_setting('rz.b')::uuid)
      or (follower_id = current_setting('rz.b')::uuid and following_id = current_setting('rz.a')::uuid);
  if n = 0 then raise notice 'B1 OK: follows gone both ways';
  else raise notice 'B1 FAILED: % follow row(s) left', n; end if;
end $$;

-- B2, B6, B7, B8 as b
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'b', 'role','authenticated')::text, true);
do $$ begin
  insert into public.follows (follower_id, following_id)
  values (current_setting('rz.b')::uuid, current_setting('rz.a')::uuid);
  raise notice 'B2 FAILED: b followed a';
exception when insufficient_privilege then raise notice 'B2 OK: refused';
  when others then raise notice 'B2 FAILED: wrong error -> %', sqlerrm; end $$;
do $$ declare n int; begin
  select count(*) into n from public.blocks;
  if n = 0 then raise notice 'B6 OK: b sees no blocks';
  else raise notice 'B6 FAILED: b sees % block row(s)', n; end if;
end $$;
do $$ begin
  insert into public.blocks (blocker_id, blocked_id)
  values (current_setting('rz.b')::uuid, current_setting('rz.a')::uuid);
  raise notice 'B7 FAILED: direct insert into blocks';
exception when insufficient_privilege then raise notice 'B7 OK: refused';
  when others then raise notice 'B7 FAILED: wrong error -> %', sqlerrm; end $$;
do $$ begin
  insert into public.notifications (user_id, actor_id, type)
  values (current_setting('rz.a')::uuid, current_setting('rz.b')::uuid, 'post_like');
  raise notice 'B8 FAILED: b notified a';
exception when insufficient_privilege then raise notice 'B8 OK: refused';
  when others then raise notice 'B8 FAILED: wrong error -> %', sqlerrm; end $$;
do $$ begin
  insert into public.post_comments (post_id, user_id, content)
  values (current_setting('rz.post_a')::uuid, current_setting('rz.b')::uuid, 'still here');
  raise notice 'B10 FAILED: b commented on a''s post';
exception when insufficient_privilege then raise notice 'B10 OK: refused';
  when others then raise notice 'B10 FAILED: wrong error -> %', sqlerrm; end $$;
reset role;

-- B11
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'graphql_public') and p.proname = 'blocked_with') then
    raise notice 'B11 FAILED: blocked_with is in an exposed schema';
  else raise notice 'B11 OK: blocked_with is not an RPC'; end if;
end $$;

-- B3: hand b a follow behind the policy's back, then try to message.
insert into public.follows (follower_id, following_id) values (:'b', :'a');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'b', 'role','authenticated')::text, true);
do $$ begin
  insert into public.messages (sender_id, recipient_id, content)
  values (current_setting('rz.b')::uuid, current_setting('rz.a')::uuid, 'still here');
  raise notice 'B3 FAILED: b messaged a';
exception when insufficient_privilege then raise notice 'B3 OK: refused';
  when others then raise notice 'B3 FAILED: wrong error -> %', sqlerrm; end $$;
reset role;
delete from public.follows where follower_id = :'b' and following_id = :'a';

-- B4, B5, once from each side.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'a', 'role','authenticated')::text, true);
do $$ declare msgs int; other_posts int; own_posts int; begin
  select count(*) into msgs from public.messages
   where (sender_id = current_setting('rz.a')::uuid and recipient_id = current_setting('rz.b')::uuid)
      or (sender_id = current_setting('rz.b')::uuid and recipient_id = current_setting('rz.a')::uuid);
  select count(*) filter (where user_id <> current_setting('rz.a')::uuid),
         count(*) filter (where user_id = current_setting('rz.a')::uuid)
    into other_posts, own_posts
    from public.posts where circle_id = current_setting('rz.circle')::uuid;
  if msgs = 0 then raise notice 'B4 OK: blocker sees no conversation';
  else raise notice 'B4 FAILED: blocker sees % message(s)', msgs; end if;
  if other_posts = 0 and own_posts = 1 then raise notice 'B5 OK: blocker sees only their own post';
  else raise notice 'B5 FAILED: blocker sees % other / % own post(s)', other_posts, own_posts; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'b', 'role','authenticated')::text, true);
do $$ declare msgs int; other_posts int; own_posts int; begin
  select count(*) into msgs from public.messages
   where (sender_id = current_setting('rz.a')::uuid and recipient_id = current_setting('rz.b')::uuid)
      or (sender_id = current_setting('rz.b')::uuid and recipient_id = current_setting('rz.a')::uuid);
  select count(*) filter (where user_id <> current_setting('rz.b')::uuid),
         count(*) filter (where user_id = current_setting('rz.b')::uuid)
    into other_posts, own_posts
    from public.posts where circle_id = current_setting('rz.circle')::uuid;
  if msgs = 0 then raise notice 'B4 OK: blocked sees no conversation';
  else raise notice 'B4 FAILED: blocked sees % message(s)', msgs; end if;
  if other_posts = 0 and own_posts = 1 then raise notice 'B5 OK: blocked sees only their own post';
  else raise notice 'B5 FAILED: blocked sees % other / % own post(s)', other_posts, own_posts; end if;
end $$;
reset role;

-- B9
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'a', 'role','authenticated')::text, true);
delete from public.blocks where blocked_id = :'b';
do $$ declare n int; begin
  select count(*) into n from public.posts where circle_id = current_setting('rz.circle')::uuid;
  if n = 2 then raise notice 'B9 OK: both posts visible after unblock';
  else raise notice 'B9 FAILED: % post(s) visible', n; end if;
end $$;

-- R1, R2, R4, R5, R8, R9, R10 as a
do $$ declare id1 uuid; fresh boolean; begin
  select report_id, is_new into id1, fresh
    from public.file_report('post', current_setting('rz.post_b')::uuid, 'harassment', 'first');
  perform set_config('rz.report', id1::text, true);
  if fresh then raise notice 'R1 OK: filed %', id1;
  else raise notice 'R1 FAILED: a first report came back as not new'; end if;
exception when others then raise notice 'R1 FAILED: %', sqlerrm; end $$;
do $$ declare id2 uuid; fresh boolean; begin
  select report_id, is_new into id2, fresh
    from public.file_report('post', current_setting('rz.post_b')::uuid, 'spam', 'second');
  if id2 = current_setting('rz.report')::uuid and not fresh then raise notice 'R2 OK: same report updated, not new';
  else raise notice 'R2 FAILED: id % (first was %), is_new %', id2, current_setting('rz.report'), fresh; end if;
exception when others then raise notice 'R2 FAILED: %', sqlerrm; end $$;
do $$ declare n int; begin
  select count(*) into n from public.reports;
  if n = 0 then raise notice 'R4 OK: a reads no reports';
  else raise notice 'R4 FAILED: a reads % report(s)', n; end if;
end $$;
do $$ begin
  perform public.resolve_report(current_setting('rz.report')::uuid, 'dismissed');
  raise notice 'R5 FAILED: a resolved a report';
exception when others then raise notice 'R5 OK: refused -> %', sqlerrm; end $$;
do $$ begin
  perform public.file_report('user', current_setting('rz.a')::uuid, 'other', null);
  raise notice 'R8 FAILED: a reported themselves';
exception when others then raise notice 'R8 OK: refused -> %', sqlerrm; end $$;
do $$ declare rid uuid; begin
  select report_id into rid from public.file_report('user', current_setting('rz.b')::uuid, 'harassment', null);
  perform set_config('rz.user_report', rid::text, true);
exception when others then raise notice 'R9 FAILED: %', sqlerrm; end $$;
do $$ begin
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values (current_setting('rz.a')::uuid, 'user', current_setting('rz.b')::uuid, 'spam');
  raise notice 'R10 FAILED: direct insert into reports';
exception when insufficient_privilege then raise notice 'R10 OK: refused';
  when others then raise notice 'R10 FAILED: wrong error -> %', sqlerrm; end $$;
reset role;

do $$ declare snap text; reason text; begin
  select r.snapshot, r.reason into snap, reason from public.reports r where id = current_setting('rz.report')::uuid;
  if snap = 'post from b' and reason = 'spam' then raise notice 'R1 OK: snapshot is the post, reason updated';
  else raise notice 'R1 FAILED: snapshot=% reason=%', snap, reason; end if;
  select r.snapshot into snap from public.reports r where id = current_setting('rz.user_report')::uuid;
  if snap like '%see you there%' then raise notice 'R9 OK: user report carries their message';
  else raise notice 'R9 FAILED: snapshot=%', snap; end if;
end $$;

-- R3, R6, R7 as the platform admin, who is not in the private circle.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role','authenticated')::text, true);
do $$ begin
  perform public.file_report('post', current_setting('rz.post_a')::uuid, 'spam', null);
  raise notice 'R3 FAILED: outsider reported a post they cannot see';
exception when others then raise notice 'R3 OK: refused -> %', sqlerrm; end $$;
do $$ declare n int; begin
  select count(*) into n from public.reports where id = current_setting('rz.report')::uuid;
  if n = 1 then raise notice 'R6 OK: admin reads the report';
  else raise notice 'R6 FAILED: admin sees % row(s)', n; end if;
end $$;
do $$ begin
  perform public.resolve_report(current_setting('rz.report')::uuid, 'remove');
exception when others then raise notice 'R7 FAILED: %', sqlerrm; end $$;
reset role;
do $$ declare n int; s text; begin
  select count(*) into n from public.posts where id = current_setting('rz.post_b')::uuid;
  select status into s from public.reports where id = current_setting('rz.report')::uuid;
  if n = 0 and s = 'actioned' then raise notice 'R7 OK: post removed, report actioned';
  else raise notice 'R7 FAILED: post rows=% status=%', n, s; end if;
end $$;

rollback;
