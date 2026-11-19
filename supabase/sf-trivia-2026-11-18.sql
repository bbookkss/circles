-- ---------------------------------------------------------------------------
-- San Francisco pub trivia nights, listed as public circles. 2026-11-18
--
-- Weekly trivia open to the public, researched 2026-11-18. Wild Side West was
-- confirmed on the bar's own site and Monaghan's on Brainstormer's; the
-- SF Trivia & Bingo nights and Napper Tandy's come from the hosts' own event
-- listings, so their descriptions say to check first. Hi Tops and The Detour
-- (secondary listings only) were left out. Free is set only where a source
-- says so; otherwise is_free stays null and the app shows nothing.
--
-- Ben (platform owner) is admin of each. Idempotent: skips any name Ben
-- already has. Coordinates from OpenStreetMap; Patriot House is the
-- Embarcadero Center building and SoMa Social shares its address with a hotel.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  ben constant uuid := '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3';
  r record;
  cid uuid;
  made int := 0;
begin
  for r in
    select * from (values
      ('Trivia at Wild Side West', 'Weekly pub trivia on Wednesdays from 8pm. Bring a team or join one there. It''s free to play.

A public event listed on Circles. It''s run by Wild Side West, with host Kitty Tapata, not by Circles. Details from wildsidewest.com.', 'Wild Side West, 424 Cortland Ave', 'Bernal Heights', 37.73903, -122.41715, array[3], '20:00', '22:00', 'Starts around 8; end not stated', true),
      ('Trivia at Monaghan''s', 'Weekly pub trivia on Tuesdays from 8pm. Bring a team or join one there. Solo players welcome.

A public event listed on Circles. It''s run by Monaghan''s, with Brainstormer trivia, not by Circles. Details from brainstormer.com.', 'Monaghan''s, 3243 Pierce St', 'Cow Hollow', 37.80005, -122.43973, array[2], '20:00', '22:00', null, null),
      ('Trivia at The Riptide', 'Weekly pub trivia on Wednesdays from 7pm. Bring a team or join one there.

A public event listed on Circles. It''s run by The Riptide, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'The Riptide, 3639 Taraval St', 'Outer Sunset', 37.74159, -122.50534, array[3], '19:00', '21:00', null, null),
      ('Trivia at Karl''s Beacon', 'Weekly pub trivia on Wednesdays from 7:30pm. Bring a team or join one there.

A public event listed on Circles. It''s run by Karl''s Beacon, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'Karl''s Beacon, 1355 Taraval St', 'Parkside', 37.74259, -122.48088, array[3], '19:30', '21:30', null, null),
      ('Trivia at Chief Sullivan''s', 'Weekly pub trivia on Wednesdays from 7pm. Bring a team or join one there. It''s free to play.

A public event listed on Circles. It''s run by Chief Sullivan''s, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'Chief Sullivan''s, 622 Green St', 'North Beach', 37.79954, -122.40974, array[3], '19:00', '21:00', null, true),
      ('Trivia at The Blue Light', 'Weekly pub trivia on Thursdays from 7pm. Bring a team or join one there. It''s free to play.

A public event listed on Circles. It''s run by The Blue Light, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'The Blue Light, 1979 Union St', 'Cow Hollow', 37.7974, -122.43162, array[4], '19:00', '21:00', null, true),
      ('Trivia at Patriot House', 'Weekly pub trivia on Wednesdays from 6pm. Bring a team or join one there.

A public event listed on Circles. It''s run by Patriot House, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'Patriot House, 2 Embarcadero Center, Level P', 'Financial District', 37.79479, -122.39844, array[3], '18:00', '20:00', null, null),
      ('Trivia at SoMa Social', 'Weekly pub trivia on Tuesdays from 6pm. Bring a team or join one there.

A public event listed on Circles. It''s run by SoMa Social, with SF Trivia & Bingo, not by Circles. Details from SF Trivia & Bingo''s listings. Check before you go, as schedules change.', 'SoMa Social, 121 7th St', 'SoMa', 37.77888, -122.40983, array[2], '18:00', '20:00', null, null),
      ('Trivia at The Napper Tandy''s', 'Weekly pub trivia on Wednesdays from 7pm. Bring a team or join one there. Booking a table ahead is recommended.

A public event listed on Circles. It''s run by The Napper Tandy''s, with Mindbent Games, not by Circles. Details from the bar''s own event listing. Check before you go, as schedules change.', 'The Napper Tandy''s, 3200 24th St', 'Mission', 37.75248, -122.4166, array[3], '19:00', '21:00', 'End not stated; reservations recommended', null)
    ) as t(name, description, location, neighborhood, lat, lng, days, s_time, e_time, note, is_free)
  loop
    if exists (select 1 from public.circles where created_by = ben and name = r.name) then
      raise notice 'skip (exists): %', r.name;
      continue;
    end if;
    insert into public.circles (name, emoji, category, description, location, neighborhood, city,
                                latitude, longitude, visibility, kind, timezone, created_by, is_free)
    values (r.name, '🧠', 'Social', r.description, r.location, r.neighborhood, 'San Francisco',
            r.lat, r.lng, 'public', 'social', 'America/Los_Angeles', ben, r.is_free)
    returning id into cid;
    insert into public.circle_members (circle_id, user_id, role) values (cid, ben, 'admin');
    insert into public.circle_schedules (circle_id, days_of_week, start_time, end_time, frequency, starts_on, note)
    values (cid, r.days, r.s_time::time, r.e_time::time, 'weekly', current_date, r.note);
    made := made + 1;
    raise notice 'created: %', r.name;
  end loop;
  raise notice '% circles created', made;
end $$;

do $$
declare bad text;
begin
  select string_agg(c.name, ', ') into bad
  from public.circles c
  where c.created_by = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3' and c.name like 'Trivia at %'
    and (c.visibility <> 'public' or c.area_latitude is null
      or not exists (select 1 from public.circle_schedules s where s.circle_id = c.id)
      or not exists (select 1 from public.circle_members m where m.circle_id = c.id and m.role = 'admin'));
  if bad is not null then raise exception 'post-condition failed for: %', bad; end if;
end $$;

commit;
