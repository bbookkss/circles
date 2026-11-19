-- ---------------------------------------------------------------------------
-- Official listings show at their real location. 2026-11-18
--
-- The blur (a random 300-700 m offset per circle) protects people: where a
-- group of neighbours meets every week. The 23 listed public events owned by
-- the Circles account are a different thing: public venues (a rooftop park,
-- a bar) already named in their descriptions. Blurring them only scattered
-- the ten Salesforce Park events across East Cut as if they were ten places.
--
-- So set_circle_area() gives circles owned by the Circles account a zero
-- offset. Everyone else's circles are untouched: same random offset, kept on
-- update, never taken from the client.
--
-- The guard that makes this safe: nobody signed in can make the Circles
-- account a circle's owner, by insert or by update. Otherwise anyone could
-- unblur their own circle by handing it over. Only the database owner (this
-- kind of file, run by hand) can create listings.
--
-- The exact columns stay withheld from clients; what changes is only that
-- for listings the shown area *is* the venue.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.set_circle_area()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  official constant uuid := 'c1c1e5c1-0000-4000-8000-00000000c1c1';
  bearing  double precision;
  distance double precision;
begin
  -- Only the database owner may create or hand over a listing.
  if new.created_by = official
     and current_user in ('anon', 'authenticated')
     and (tg_op = 'INSERT' or old.created_by is distinct from new.created_by) then
    raise exception 'only Circles can create listings' using errcode = '42501';
  end if;

  if new.created_by = official then
    -- A listing: public venue, shown where it is.
    new.area_offset_north_m := 0;
    new.area_offset_east_m := 0;
  -- Never take an offset from the client. A fresh one on insert, the stored
  -- one on update, and a fresh one if a row somehow has none (or was a
  -- listing until now).
  elsif tg_op = 'INSERT' or old.area_offset_north_m is null or old.area_offset_east_m is null
        or (old.area_offset_north_m = 0 and old.area_offset_east_m = 0) then
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
    new.area_latitude := new.latitude
      + (new.area_offset_north_m / 6378137) * (180 / pi());
    new.area_longitude := new.longitude
      + (new.area_offset_east_m / (6378137 * cos(radians(new.latitude)))) * (180 / pi());
  end if;

  return new;
end;
$$;

-- Recompute the listings' areas under the new rule.
update public.circles
   set latitude = latitude
 where created_by = 'c1c1e5c1-0000-4000-8000-00000000c1c1';

do $$
begin
  if exists (select 1 from public.circles
             where created_by = 'c1c1e5c1-0000-4000-8000-00000000c1c1'
               and (area_latitude is distinct from latitude or area_longitude is distinct from longitude)) then
    raise exception 'post-condition: a listing is not at its real location';
  end if;
  if exists (select 1 from public.circles
             where created_by is distinct from 'c1c1e5c1-0000-4000-8000-00000000c1c1'
               and latitude is not null
               and area_latitude = latitude and area_longitude = longitude) then
    raise exception 'post-condition: a person''s circle lost its blur';
  end if;
end $$;

commit;
