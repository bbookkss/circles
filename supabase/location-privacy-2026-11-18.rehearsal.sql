-- Rehearsal for location-privacy-2026-11-18.sql and
-- location-lockdown-2026-11-18.sql. Rolled back; changes nothing.
--
-- Run after BOTH are applied:
--
--   psql "$SUPABASE_DB_URL" -f supabase/location-privacy-2026-11-18.rehearsal.sql
--
-- Needs two profiles. Builds its own public circle with one admin; the
-- second profile is an outsider. Each test prints OK or FAILED:
--
--   L1  a new circle gets an area 300-700m from its point
--   L2  moving the pin keeps the offset, so the area moves with the point
--   L3  a client cannot set the offset, even as the circle's admin
--   L4  a member gets the exact point and venue from circle_places()
--   L5  an outsider gets nothing from circle_places()
--   L6  anon cannot call circle_places()
--   L7  anon cannot read latitude
--   L8  a signed-in outsider cannot read location, or filter on latitude
--   L9  select * is refused, so no forgotten query can sweep the columns up
--   L10 anon can read the area of a public circle
--   L11 circle_preview() no longer returns location
--   L12 a client inserting its own offset gets a fresh one instead
begin;

select
  (select id from public.profiles order by created_at limit 1)::text          as admin,
  (select id from public.profiles order by created_at offset 1 limit 1)::text as outsider,
  'aaaa0000-0000-0000-0000-00000000000b'                                      as circle
\gset

insert into public.circles (id, name, visibility, kind, created_by, timezone, latitude, longitude, location, neighborhood)
values (:'circle', 'Location rehearsal', 'public', 'social', :'admin', 'America/Los_Angeles',
        37.7596, -122.4269, 'Dolores Park, north gate', 'Mission');
insert into public.circle_members (circle_id, user_id, role) values (:'circle', :'admin', 'admin');

select set_config('rz.circle', :'circle', true),
       set_config('rz.admin', :'admin', true),
       set_config('rz.outsider', :'outsider', true);

-- Distance in metres between a circle's point and its area centre.
create function pg_temp.offset_m(cid uuid) returns double precision language sql as $$
  select sqrt(
    power((area_latitude - latitude) * pi() / 180 * 6378137, 2) +
    power((area_longitude - longitude) * pi() / 180 * 6378137 * cos(radians(latitude)), 2))
  from public.circles where id = cid;
$$;

-- L1
do $$ declare d double precision; begin
  d := pg_temp.offset_m(current_setting('rz.circle')::uuid);
  if d between 299 and 701 then raise notice 'L1 OK: area centre is % m from the point', round(d::numeric);
  else raise notice 'L1 FAILED: offset is % m', d; end if;
end $$;

-- L2
do $$ declare n0 double precision; e0 double precision; n1 double precision; e1 double precision; d double precision; begin
  select area_offset_north_m, area_offset_east_m into n0, e0 from public.circles where id = current_setting('rz.circle')::uuid;
  update public.circles set latitude = latitude + 0.01, longitude = longitude - 0.01 where id = current_setting('rz.circle')::uuid;
  select area_offset_north_m, area_offset_east_m into n1, e1 from public.circles where id = current_setting('rz.circle')::uuid;
  d := pg_temp.offset_m(current_setting('rz.circle')::uuid);
  if n0 = n1 and e0 = e1 and d between 299 and 701 then raise notice 'L2 OK: offset unchanged after the move';
  else raise notice 'L2 FAILED: offset went from (%, %) to (%, %)', n0, e0, n1, e1; end if;
end $$;

-- L3: remember the offset, let the admin try to overwrite it, compare.
select set_config('rz.n0', area_offset_north_m::text, true), set_config('rz.e0', area_offset_east_m::text, true)
  from public.circles where id = :'circle';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role','authenticated')::text, true);
do $$ begin
  update public.circles set area_offset_north_m = 0, area_offset_east_m = 0, area_latitude = 0
   where id = current_setting('rz.circle')::uuid;
exception when others then null; -- refused outright is also a pass
end $$;
reset role;
do $$ declare n1 double precision; e1 double precision; begin
  select area_offset_north_m, area_offset_east_m into n1, e1 from public.circles where id = current_setting('rz.circle')::uuid;
  if n1 = current_setting('rz.n0')::double precision and e1 = current_setting('rz.e0')::double precision
  then raise notice 'L3 OK: offset unchanged by a client write';
  else raise notice 'L3 FAILED: offset went from (%, %) to (%, %)', current_setting('rz.n0'), current_setting('rz.e0'), n1, e1; end if;
end $$;

-- L12
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role','authenticated')::text, true);
insert into public.circles (id, name, visibility, kind, created_by, timezone, latitude, longitude,
                            area_offset_north_m, area_offset_east_m, area_latitude, area_longitude)
values ('aaaa0000-0000-0000-0000-00000000000c', 'Offset rehearsal', 'public', 'social', :'admin', 'America/Los_Angeles',
        37.76, -122.42, 0, 0, 37.76, -122.42);
reset role;
do $$ declare d double precision; begin
  d := pg_temp.offset_m('aaaa0000-0000-0000-0000-00000000000c');
  if d between 299 and 701 then raise notice 'L12 OK: client offset replaced (% m)', round(d::numeric);
  else raise notice 'L12 FAILED: offset is % m', d; end if;
end $$;

-- L4
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role','authenticated')::text, true);
do $$ declare loc text; lat double precision; begin
  select location, latitude into loc, lat from public.circle_places(array[current_setting('rz.circle')::uuid]);
  if loc = 'Dolores Park, north gate' and lat is not null then raise notice 'L4 OK: member sees the place';
  else raise notice 'L4 FAILED: member got location=% latitude=%', loc, lat; end if;
end $$;
reset role;

-- L5, L8, L9
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'outsider', 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from public.circle_places(array[current_setting('rz.circle')::uuid]);
  if n = 0 then raise notice 'L5 OK: outsider gets no rows';
  else raise notice 'L5 FAILED: outsider got % row(s)', n; end if;
end $$;
do $$ declare t text; begin
  select location into t from public.circles where id = current_setting('rz.circle')::uuid;
  raise notice 'L8 FAILED: outsider read location %', t;
exception when insufficient_privilege then raise notice 'L8 OK: location refused';
end $$;
do $$ declare n int; begin
  select count(*) into n from public.circles where latitude > 0;
  raise notice 'L8 FAILED: outsider filtered on latitude (% rows)', n;
exception when insufficient_privilege then raise notice 'L8 OK: filtering on latitude refused';
end $$;
do $$ declare n int; begin
  perform * from public.circles limit 1;
  raise notice 'L9 FAILED: select * was allowed';
exception when insufficient_privilege then raise notice 'L9 OK: select * refused';
end $$;
reset role;

-- L6, L7, L10
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
do $$ begin
  perform public.circle_places(array[current_setting('rz.circle')::uuid]);
  raise notice 'L6 FAILED: anon called circle_places';
exception when insufficient_privilege then raise notice 'L6 OK: anon refused';
end $$;
do $$ declare v double precision; begin
  select latitude into v from public.circles where id = current_setting('rz.circle')::uuid;
  raise notice 'L7 FAILED: anon read latitude %', v;
exception when insufficient_privilege then raise notice 'L7 OK: latitude refused';
end $$;
do $$ declare v double precision; begin
  select area_latitude into v from public.circles where id = current_setting('rz.circle')::uuid;
  if v is not null then raise notice 'L10 OK: anon reads the area';
  else raise notice 'L10 FAILED: no area for a public circle'; end if;
end $$;
reset role;

-- L11
do $$ begin
  if exists (
    select 1 from public.circle_preview(current_setting('rz.circle')::uuid) p
     where to_jsonb(p) ? 'location'
  ) then raise notice 'L11 FAILED: circle_preview returns location';
  else raise notice 'L11 OK: preview carries no venue'; end if;
end $$;

rollback;
