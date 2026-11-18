-- ---------------------------------------------------------------------------
-- Location privacy, step 1 of 2 — 2026-11-18
--
-- A circle publishes when and where a group of people will be. The exact
-- point is for members. Three things were letting it out:
--
--   1. The blur was reversible. approxArea() displaced the point by an offset
--      derived from FNV-1a of the circle's id. The id is in every circle URL
--      and the algorithm is in a public repo, so anyone could recompute the
--      offset and subtract it. Deterministic was meant to stop averaging
--      attacks; it also made the offset public.
--
--   2. The coordinates were readable directly. Nothing restricted columns on
--      circles, so any visitor holding the anon key (it ships in every page)
--      could ask PostgREST for latitude and longitude of every public circle,
--      skipping the server-side blur entirely.
--
--   3. The venue name went to everyone. `location` is the free-text "what to
--      call it" field, usually the place itself ("Dolores Park"), and it was
--      printed to logged-out visitors and returned by circle_preview().
--
-- This file fixes 1 and prepares 2 and 3 without breaking the deployed app:
--
--   - area_latitude / area_longitude: the shown centre, computed here by a
--     trigger from the exact point plus a per-circle offset drawn at random
--     once and stored. Random rather than derived, so nothing outside the
--     database can reproduce it; stored, so it is the same on every read and
--     averaging reveals nothing. A moved pin keeps its offset, so the area
--     moves with the point instead of landing somewhere new each time.
--   - circle_places(cids): the exact point and venue name, for members only.
--   - circle_preview() stops returning `location`.
--
-- Step 2, location-lockdown-2026-11-18.sql, revokes SELECT on the exact
-- columns. Order matters, because the current app reads those columns:
--
--   1. apply this file
--   2. deploy the app that reads area_* and circle_places()
--   3. apply location-lockdown-2026-11-18.sql
--
-- Then run location-privacy-2026-11-18.rehearsal.sql.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. The shown area and the offset that produces it.
--
-- The offset columns are as private as the point: offset plus area gives the
-- point back. Step 2 withholds them along with latitude and longitude.
-- ---------------------------------------------------------------------------
alter table public.circles
  add column if not exists area_latitude double precision,
  add column if not exists area_longitude double precision,
  add column if not exists area_offset_north_m double precision,
  add column if not exists area_offset_east_m double precision;

-- Radius of the drawn disc is 1100m (BLUR_RADIUS_M in src/lib/approxLocation.ts).
-- The offset is 300-700m: the floor keeps the centre from being a good guess,
-- the ceiling keeps the point well inside the disc.
create or replace function public.set_circle_area()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  bearing double precision;
  distance double precision;
begin
  -- Never take an offset from the client. A fresh one on insert, the stored
  -- one on update, and a fresh one if a row somehow has none.
  if tg_op = 'INSERT' or old.area_offset_north_m is null or old.area_offset_east_m is null then
    bearing := random() * 2 * pi();
    distance := 300 + random() * 400;
    new.area_offset_north_m := distance * cos(bearing);
    new.area_offset_east_m := distance * sin(bearing);
  else
    new.area_offset_north_m := old.area_offset_north_m;
    new.area_offset_east_m := old.area_offset_east_m;
  end if;

  if new.latitude is null or new.longitude is null then
    new.area_latitude := null;
    new.area_longitude := null;
  else
    -- Metres to degrees. Longitude degrees shorten towards the poles, hence
    -- the cos(latitude) term.
    new.area_latitude := new.latitude
      + (new.area_offset_north_m / 6378137) * (180 / pi());
    new.area_longitude := new.longitude
      + (new.area_offset_east_m / (6378137 * cos(radians(new.latitude)))) * (180 / pi());
  end if;

  return new;
end;
$$;

drop trigger if exists circles_area on public.circles;
create trigger circles_area
  before insert or update on public.circles
  for each row execute function public.set_circle_area();

-- Backfill. Any update fires the trigger; the kind and timezone guards only
-- fire on updates of those columns, so they stay quiet.
update public.circles set area_latitude = null;

-- ---------------------------------------------------------------------------
-- 2. The exact point and venue name, for members.
--
-- Security definer because step 2 takes the columns away from the caller's
-- own role. The membership check is the whole function.
-- ---------------------------------------------------------------------------
create or replace function public.circle_places(cids uuid[])
returns table (circle_id uuid, latitude double precision, longitude double precision, location text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.latitude, c.longitude, c.location
    from public.circles c
   where c.id = any(cids)
     and public.is_circle_member(c.id, auth.uid());
$$;

-- Supabase grants EXECUTE on new functions to anon by name, which a revoke
-- from public does not touch (see function-grants-2026-09-29.sql).
revoke all on function public.circle_places(uuid[]) from public, anon;
grant execute on function public.circle_places(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. circle_preview without the venue name.
--
-- The return type changes, so it has to be dropped rather than replaced. The
-- deployed app falls back to neighborhood when location is missing.
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
  visibility text,
  kind text,
  member_count bigint,
  creator_name text
)
language sql security definer set search_path = public as $$
  select
    c.id, c.name, c.description, c.emoji, c.category,
    c.neighborhood, c.visibility, c.kind,
    (select count(*) from public.circle_members m where m.circle_id = c.id),
    (select p.full_name from public.profiles p where p.id = c.created_by)
  from public.circles c
  where c.id = circle_preview.circle_id;
$$;

revoke all on function public.circle_preview(uuid) from public;
grant execute on function public.circle_preview(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions. A failure here rolls the whole file back.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.circles
     where latitude is not null and longitude is not null
       and (area_latitude is null or area_offset_north_m is null)
  ) then
    raise exception 'backfill incomplete: a circle with a pin has no area';
  end if;

  if has_function_privilege('anon', 'public.circle_places(uuid[])', 'execute') then
    raise exception 'anon can execute circle_places';
  end if;
  if not has_function_privilege('authenticated', 'public.circle_places(uuid[])', 'execute') then
    raise exception 'authenticated cannot execute circle_places';
  end if;
  if not has_function_privilege('anon', 'public.circle_preview(uuid)', 'execute') then
    raise exception 'anon lost circle_preview, which logged-out previews need';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
