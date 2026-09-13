-- ---------------------------------------------------------------------------
-- Carry the reminder opt-in through signup — 2026-09-13
--
-- Supersedes handle_new_user() from usernames-2026-09-08.sql. Same body plus
-- one column.
--
-- The profile row is built by this trigger from the metadata supabase.auth
-- was handed at signUp, so a checkbox on the signup form only reaches the
-- profile if it is read here. Without this the box would appear to work and
-- silently do nothing, which is the worst kind of consent bug: the person
-- believes they opted in, the database says they did not.
--
-- Defaults to false when the key is absent or unparseable. Opt-in has to be a
-- deliberate act, and an account created by any other path should not end up
-- subscribed by accident.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, instagram, username, email_reminders)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'instagram',
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    coalesce((new.raw_user_meta_data->>'email_reminders')::boolean, false)
  );
  return new;
end;
$$;
