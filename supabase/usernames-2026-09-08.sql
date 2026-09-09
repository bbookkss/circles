-- ---------------------------------------------------------------------------
-- Usernames — 2026-09-08
--
-- Email stays required at signup and remains the credential Supabase actually
-- authenticates against. A username is optional, and only ever an alias people
-- can type instead of their email.
--
-- Note what is NOT here: any way to resolve a username to an email through the
-- API. That lookup happens server-side with the service-role key, because the
-- anon key ships in the browser — a public lookup would turn the (public)
-- username list into a directory of everyone's email address.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text;

-- Stored lowercase; the app normalises before writing. The index is on
-- lower() anyway so a stray capital can never create a second "rosa".
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username)) where username is not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- The previous migration revoked table-level UPDATE and handed back columns
-- one at a time, so a new editable column has to be granted explicitly or
-- profile editing silently cannot write it.
grant update (username) on public.profiles to authenticated;

-- Usernames are public: they appear on profiles and are how people find each
-- other. Safe to expose now that they are not a route to an email address.
grant select (username) on public.profiles to anon;

-- Carry a username chosen at signup through to the profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, instagram, username)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'instagram',
    nullif(lower(new.raw_user_meta_data->>'username'), '')
  );
  return new;
end;
$$;
