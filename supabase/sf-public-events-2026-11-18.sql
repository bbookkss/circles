-- ---------------------------------------------------------------------------
-- San Francisco public events, listed as public circles. 2026-11-18
--
-- Free or open recurring events in SF, researched on 2026-11-18, so the map
-- has something on it for people arriving from the landing page. Each one is
-- run by someone else; the description says so in its last paragraph and
-- names where the details came from. Ben (platform owner) is the admin, so
-- the listing can be corrected or removed from the app.
--
-- Confirmed at the organiser's own page:
--   Lindy in the Park (lindyinthepark.com/about)
--   Salesforce Park's free classes: Zumba, vinyasa yoga, bootcamp, Metcon
--   (theeastcut.org/salesforce-park)
-- From secondary listings, so each description says to check first:
--   UCSF Bike Bus (SF Bicycle Coalition, via a ride directory)
--   Golden Gate Park roller skating at Skatin' Place (event calendars)
--   Board games with EGL (their Meetup; $7 cover, not free)
--
-- Coordinates: OpenStreetMap for the addresses; the Golden Gate Park spots
-- placed on JFK Drive from the avenue crossings. The circles_area trigger
-- gives each a displaced area for non-members, as for any circle.
--
-- Idempotent: a circle is skipped if Ben already has one with that name.
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
      -- name, emoji, category, description, location (venue, members only), neighborhood, lat, lng, days, start, end, schedule note
      ('Lindy in the Park', '💃', 'Arts & Culture',
       E'Free swing dancing every Sunday on the car-free stretch of JFK Drive in Golden Gate Park, with a free beginner lesson at noon. All ages and levels, no partner or experience needed. Weather permitting.\n\nA public event listed on Circles. It''s run by Lindy in the Park, not by Circles. Details from lindyinthepark.com.',
       'JFK Drive between 8th and 10th Ave, Golden Gate Park', 'Golden Gate Park', 37.77225, -122.46690, array[0], '11:00', '14:00', 'Beginner lesson at noon'),

      ('Zumba at Salesforce Park', '🎶', 'Sports',
       E'A free Zumba class on the rooftop park every Monday evening. Open to everyone; just turn up.\n\nA public event listed on Circles. It''s run by FITNESS SF at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.',
       'Salesforce Park, rooftop of the Salesforce Transit Center', 'East Cut', 37.78912, -122.39665, array[1], '18:00', '19:00', null),

      ('Lunchtime yoga at Salesforce Park', '🧘', 'Sports',
       E'Free vinyasa yoga in the rooftop park every Wednesday at lunchtime. Open to everyone.\n\nA public event listed on Circles. It''s run by FITNESS SF at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.',
       'Salesforce Park, rooftop of the Salesforce Transit Center', 'East Cut', 37.78912, -122.39665, array[3], '12:30', '13:30', null),

      ('Thursday morning bootcamp', '🏃', 'Sports',
       E'A free hour of bootcamp in Salesforce Park before work, every Thursday. Open to everyone.\n\nA public event listed on Circles. It''s run by FITNESS SF at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.',
       'Salesforce Park, rooftop of the Salesforce Transit Center', 'East Cut', 37.78912, -122.39665, array[4], '08:00', '09:00', null),

      ('Saturday Metcon at Salesforce Park', '💪', 'Sports',
       E'A free metabolic conditioning workout in the rooftop park every Saturday morning. Open to everyone.\n\nA public event listed on Circles. It''s run at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.',
       'Salesforce Park, rooftop of the Salesforce Transit Center', 'East Cut', 37.78912, -122.39665, array[6], '10:00', '11:00', null),

      ('UCSF Bike Bus', '🚲', 'Outdoors',
       E'A free, casual group commute every Thursday morning from the Ferry Building to UCSF Mission Bay, ending near Chase Center around 8:45. Open to anyone, not just UCSF. A second group starts from the Wiggle (Page and Scott) at 8:00.\n\nA public event listed on Circles. It''s run by the SF Bicycle Coalition, not by Circles. Details from a community ride directory; check sfbike.org before you go, as times change with the seasons.',
       'Ferry Building, Embarcadero (meet 8:15, roll 8:30)', 'Embarcadero', 37.79555, -122.39347, array[4], '08:15', '08:45', 'Meet 8:15, roll 8:30'),

      ('Golden Gate Park roller skating', '🛼', 'Sports',
       E'Free roller skating at Skatin'' Place every Sunday afternoon, with a DJ and, most weeks, someone happy to teach a few roller disco moves. Bring your own skates.\n\nA public event listed on Circles. It''s run by the skaters at Skatin'' Place, not by Circles. Details from SF event calendars; check before you go, as it can be cancelled.',
       'Skatin'' Place, 6th Ave and JFK Drive, Golden Gate Park', 'Golden Gate Park', 37.77265, -122.46334, array[0], '12:00', '17:00', null),

      ('Board games with EGL', '🎲', 'Social',
       E'A weekly board game night on Mondays at The Game Parlour. Newcomers welcome, and you don''t need to bring games. There''s a $7 cover at the venue.\n\nA public event listed on Circles. It''s run by the Euro Gaming League (EGL), not by Circles. Details from their Meetup; they now post events on Heylo, so check there before you go.',
       'The Game Parlour, 1342 Irving St', 'Inner Sunset', 37.76399, -122.47246, array[1], '18:00', '21:00', '$7 cover')
    ) as t(name, emoji, category, description, location, neighborhood, lat, lng, days, s_time, e_time, note)
  loop
    if exists (select 1 from public.circles where created_by = ben and name = r.name) then
      raise notice 'skip (exists): %', r.name;
      continue;
    end if;

    insert into public.circles (name, emoji, category, description, location, neighborhood, city,
                                latitude, longitude, visibility, kind, timezone, created_by)
    values (r.name, r.emoji, r.category, r.description, r.location, r.neighborhood, 'San Francisco',
            r.lat, r.lng, 'public', 'social', 'America/Los_Angeles', ben)
    returning id into cid;

    insert into public.circle_members (circle_id, user_id, role) values (cid, ben, 'admin');

    insert into public.circle_schedules (circle_id, days_of_week, start_time, end_time, frequency, starts_on, note)
    values (cid, r.days, r.s_time::time, r.e_time::time, 'weekly', current_date, r.note);

    made := made + 1;
    raise notice 'created: % (%)', r.name, cid;
  end loop;
  raise notice '% circles created', made;
end $$;

-- Post-conditions: every listed circle is public, has an area, a weekly
-- schedule, and Ben as admin.
do $$
declare bad text;
begin
  select string_agg(c.name, ', ') into bad
  from public.circles c
  where c.created_by = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3'
    and c.description like '%A public event listed on Circles.%'
    and (c.visibility <> 'public'
      or c.area_latitude is null
      or not exists (select 1 from public.circle_schedules s where s.circle_id = c.id)
      or not exists (select 1 from public.circle_members m where m.circle_id = c.id and m.role = 'admin'));
  if bad is not null then
    raise exception 'post-condition failed for: %', bad;
  end if;
end $$;

commit;
