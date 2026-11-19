-- ---------------------------------------------------------------------------
-- A "Circles" account owns the listed public events. 2026-11-18
--
-- The 23 SF events, trivia nights and Salesforce Park programmes listed today
-- were created with Ben as creator, admin and only member, so every one of
-- them landed in his Home week, his reminders and Radius. They now belong to
-- a separate profile, "Circles", and Ben's memberships (and the few check-ins
-- he tapped on them) are removed, so his week is his own again.
--
-- The account is a user with no password and no sign-in identity: nobody can
-- log in as it. Its email reminders are off, in its profile and on every
-- membership, so no reminder is ever addressed to it. The email is on the
-- project's own domain.
--
-- Editing a listing in the app is gated on circles.created_by, so these are
-- now changed by SQL like this file, not through the edit page.
--
-- Idempotent.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  ben     constant uuid := '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3';
  listing constant uuid := 'c1c1e5c1-0000-4000-8000-00000000c1c1';
  ids     uuid[];
begin
  if not exists (select 1 from auth.users where id = listing) then
    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', listing, 'authenticated', 'authenticated',
            'listings@hicircles.com', now(),
            '{"provider":"none","providers":[]}'::jsonb,
            '{"full_name":"Circles","email_reminders":false}'::jsonb,
            now(), now());
    -- handle_new_user() creates the profile from the metadata above.
  end if;

  select array_agg(id) into ids from public.circles
   where created_by = ben and description like '%A public event listed on Circles.%';
  if ids is null then
    raise notice 'nothing to move';
    return;
  end if;

  update public.circles set created_by = listing where id = any(ids);

  insert into public.circle_members (circle_id, user_id, role, email_reminders)
  select unnest(ids), listing, 'admin', false
  on conflict do nothing;

  delete from public.scheduled_check_ins where user_id = ben and circle_id = any(ids);
  delete from public.circle_check_ins    where user_id = ben and circle_id = any(ids);
  delete from public.circle_members      where user_id = ben and circle_id = any(ids);

  raise notice 'moved % listed circles to the Circles account', array_length(ids, 1);
end $$;

do $$
declare
  ben     constant uuid := '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3';
  listing constant uuid := 'c1c1e5c1-0000-4000-8000-00000000c1c1';
begin
  if not exists (select 1 from public.profiles where id = listing and full_name = 'Circles' and email_reminders = false) then
    raise exception 'post-condition: Circles profile missing or reminders on';
  end if;
  if exists (select 1 from auth.identities where user_id = listing) then
    raise exception 'post-condition: the Circles account must have no sign-in identity';
  end if;
  if exists (select 1 from public.circles c join public.circle_members m on m.circle_id = c.id and m.user_id = ben
             where c.description like '%A public event listed on Circles.%') then
    raise exception 'post-condition: Ben is still a member of a listed circle';
  end if;
  if exists (select 1 from public.circles c
             where c.description like '%A public event listed on Circles.%'
               and not exists (select 1 from public.circle_members m where m.circle_id = c.id and m.user_id = listing and m.role = 'admin')) then
    raise exception 'post-condition: a listed circle has no Circles admin';
  end if;
end $$;

commit;
