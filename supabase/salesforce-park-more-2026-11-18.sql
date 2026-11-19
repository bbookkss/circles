-- ---------------------------------------------------------------------------
-- More of Salesforce Park's free programmes, as public circles. 2026-11-18
--
-- From the park's own schedule (theeastcut.org/salesforce-park), alongside the
-- four added in sf-public-events-2026-11-18.sql. All free and open to the
-- public. Monthly ones are anchored on a real upcoming date, which the
-- schedule maths reads as "the same numbered weekday each month".
-- Family Storytime is left out: its dates (every other week to January, then
-- the third Wednesday) don't fit one recurrence, and wrong dates are worse
-- than none. Idempotent; Ben is admin of each.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  ben constant uuid := '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3';
  r record; cid uuid; made int := 0;
begin
  for r in
    select * from (values
      ('High Fitness at Salesforce Park', '🔥', 'Sports', 'A free HIGH Fitness class in the rooftop park every Thursday afternoon: cardio set to music. Open to everyone.

A public event listed on Circles. It''s run by HIGH Fitness at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.', array[4], '13:00', '14:00', 'weekly', date '2026-11-19', null),
      ('Bluegrass Breeze', '🪕', 'Music', 'Free live bluegrass in the rooftop park every Wednesday over lunch. Bring something to eat and stay a while.

A public event listed on Circles. It''s run by Give It Up for The Band at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.', array[3], '11:30', '13:30', 'weekly', date '2026-11-18', null),
      ('Toddler Thursday', '🧸', 'Social', 'Free music and movement for toddlers aged 1 to 4 and their grown-ups, every Thursday morning in the rooftop park.

A public event listed on Circles. It''s run by JAMaROO Kids at Salesforce Park, not by Circles. Details from theeastcut.org/salesforce-park.', array[4], '10:00', '10:45', 'weekly', date '2026-11-19', 'For ages 1 to 4 with a grown-up'),
      ('Birding walk at Salesforce Park', '🐦', 'Outdoors', 'A free bird walk around the rooftop park on the first Wednesday of each month, for birders of every level. Binoculars help but aren''t needed.

A public event listed on Circles. It''s run by Golden Gate Bird Alliance volunteers, not by Circles. Details from theeastcut.org/salesforce-park.', array[3], '08:00', '09:00', 'monthly', date '2026-12-02', 'First Wednesday of the month'),
      ('Garden tour at Salesforce Park', '🌿', 'Outdoors', 'A free guided tour of the rooftop park''s gardens on the fourth Wednesday of each month.

A public event listed on Circles. It''s run by the San Francisco Botanical Garden, not by Circles. Details from theeastcut.org/salesforce-park.', array[3], '10:00', '11:30', 'monthly', date '2026-11-25', 'Fourth Wednesday of the month'),
      ('Dave Parker Sextet at Salesforce Park', '🎷', 'Music', 'Free live jazz from the Dave Parker Sextet in the rooftop park, over lunch on the fourth Friday of each month.

A public event listed on Circles. It''s run by the Dave Parker Sextet, not by Circles. Details from theeastcut.org/salesforce-park.', array[5], '11:30', '13:00', 'monthly', date '2026-11-27', 'Fourth Friday of the month')
    ) as t(name, emoji, category, description, days, s_time, e_time, freq, anchor, note)
  loop
    if exists (select 1 from public.circles where created_by = ben and name = r.name) then
      raise notice 'skip (exists): %', r.name; continue;
    end if;
    insert into public.circles (name, emoji, category, description, location, neighborhood, city,
                                latitude, longitude, visibility, kind, timezone, created_by, is_free)
    values (r.name, r.emoji, r.category, r.description, 'Salesforce Park, rooftop of the Salesforce Transit Center',
            'East Cut', 'San Francisco', 37.78912, -122.39665, 'public', 'social', 'America/Los_Angeles', ben, true)
    returning id into cid;
    insert into public.circle_members (circle_id, user_id, role) values (cid, ben, 'admin');
    insert into public.circle_schedules (circle_id, days_of_week, start_time, end_time, frequency, starts_on, note)
    values (cid, r.days, r.s_time::time, r.e_time::time, r.freq, r.anchor, r.note);
    made := made + 1;
    raise notice 'created: % (next: %)', r.name, public.circle_next_occurrence(cid);
  end loop;
  raise notice '% circles created', made;
end $$;

commit;
