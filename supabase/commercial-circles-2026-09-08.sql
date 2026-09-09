-- ---------------------------------------------------------------------------
-- Commercial circles — 2026-09-08
--
-- Restaurants and businesses can run circles to promote local events, but
-- only after a real conversation, so nobody can pose as a business they do
-- not own.
--
-- The gate is on the ACCOUNT, not the circle: you verify a person once, and
-- from then on they can mark their own circles commercial.
--
-- Route in:  user submits a business_request -> you call them -> you approve
--            -> profiles.is_business flips true.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. profiles.is_business — and locking it so users cannot grant it to
--    themselves.
--
-- This is the whole security story. The existing policy is
--   profiles: own update  USING (auth.uid() = id)
-- combined with GRANT ALL ON profiles TO authenticated, which means a signed
-- in user may write ANY column on their own row. A plain boolean would be
-- self-serve: one PATCH and anyone is a "verified business".
--
-- Column-level privileges are the fix. Note the trap recorded in HANDOFF.md:
-- a column-level revoke is silently inert while a table-level grant stands,
-- so the table-level UPDATE must go first and the columns be handed back one
-- by one. is_business is simply never granted.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_business boolean not null default false;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, bio, instagram)
  on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Platform admins — you, and anyone you later add.
--
-- Deliberately not readable from the client. Membership is only ever tested
-- through the security-definer helper, so the roster is not enumerable.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = uid);
$$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. circles.kind — 'social' | 'commercial'
-- ---------------------------------------------------------------------------
alter table public.circles
  add column if not exists kind text not null default 'social';

alter table public.circles drop constraint if exists circles_kind_check;
alter table public.circles add constraint circles_kind_check
  check (kind in ('social', 'commercial'));

-- Enforced in the database, not just the UI: a circle can only be commercial
-- if the person writing it is a verified business or a platform admin. This
-- covers the REST API directly, not only the create form.
create or replace function public.enforce_circle_kind()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'commercial'
     and (tg_op = 'INSERT' or old.kind is distinct from 'commercial') then
    if not (
      coalesce((select is_business from public.profiles where id = auth.uid()), false)
      or public.is_platform_admin(auth.uid())
    ) then
      raise exception 'only verified businesses can create commercial circles'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists circles_kind_guard on public.circles;
create trigger circles_kind_guard
  before insert or update of kind on public.circles
  for each row execute function public.enforce_circle_kind();


-- ---------------------------------------------------------------------------
-- 4. business_requests — the in-app route in
-- ---------------------------------------------------------------------------
create table if not exists public.business_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  contact_name  text,
  phone         text,
  email         text,
  message       text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

-- One open request per person, so the queue cannot be flooded.
create unique index if not exists business_requests_one_pending
  on public.business_requests (user_id) where status = 'pending';

alter table public.business_requests enable row level security;

drop policy if exists "business_requests: insert own"    on public.business_requests;
drop policy if exists "business_requests: read own"      on public.business_requests;
drop policy if exists "business_requests: admin update"  on public.business_requests;

create policy "business_requests: insert own" on public.business_requests
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "business_requests: read own" on public.business_requests
  for select to authenticated
  using (auth.uid() = user_id or public.is_platform_admin(auth.uid()));

create policy "business_requests: admin update" on public.business_requests
  for update to authenticated
  using (public.is_platform_admin(auth.uid()));

revoke all on table public.business_requests from anon;
grant select, insert, update on table public.business_requests to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Approving a request — the only way is_business is ever set.
-- ---------------------------------------------------------------------------
create or replace function public.review_business_request(request_id uuid, approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not authorised';
  end if;

  select user_id into target from public.business_requests where id = request_id;
  if target is null then
    raise exception 'no such request';
  end if;

  update public.business_requests
     set status      = case when approve then 'approved' else 'rejected' end,
         reviewed_at = now()
   where id = request_id;

  if approve then
    update public.profiles set is_business = true where id = target;
  end if;
end;
$$;

revoke all on function public.review_business_request(uuid, boolean) from public, anon;
grant execute on function public.review_business_request(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Teach circle_preview about kind, so the shared-link preview of a private
--    business circle still shows the badge. Same column set as before plus
--    kind; still no coordinates.
-- ---------------------------------------------------------------------------
drop function if exists public.circle_preview(uuid);

create function public.circle_preview(circle_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  emoji text,
  category text,
  neighborhood text,
  location text,
  visibility text,
  kind text,
  member_count bigint,
  creator_name text
)
language sql security definer set search_path = public as $$
  select
    c.id, c.name, c.description, c.emoji, c.category,
    c.neighborhood, c.location, c.visibility, c.kind,
    (select count(*) from public.circle_members m where m.circle_id = c.id),
    (select p.full_name from public.profiles p where p.id = c.created_by)
  from public.circles c
  where c.id = circle_preview.circle_id;
$$;

revoke all on function public.circle_preview(uuid) from public;
grant execute on function public.circle_preview(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 7. Seed the first platform admin: Ben.
--
-- Pinned to the user id on purpose. Matching on profiles.full_name would be
-- a hole, because full_name is user-editable: anyone who set their display
-- name to the right string before this ran would be handed admin.
-- ---------------------------------------------------------------------------
insert into public.platform_admins (user_id)
select id from public.profiles where id = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3'
on conflict (user_id) do nothing;
