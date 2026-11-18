-- ---------------------------------------------------------------------------
-- Location privacy, step 2 of 2 — 2026-11-18
--
-- Apply only after location-privacy-2026-11-18.sql AND after the app that
-- reads area_* and circle_places() is deployed. The previous app selects
-- circles.* and latitude directly; against this file those reads fail.
--
-- Takes SELECT on the exact location away from anon and authenticated:
-- latitude, longitude, location, and the two offset columns (offset plus
-- area gives the point back). Members read them through circle_places().
--
-- The trap from docs/HANDOFF.md applies: a column-level revoke is silently
-- inert while a table-level grant stands. So the table-level SELECT
-- goes, and every other column is handed back by name.
--
-- Consequence to remember: a column added to circles later is NOT readable
-- by the app until it is granted. Add it to a grant in the same migration
-- that creates it.
-- ---------------------------------------------------------------------------

begin;

revoke select on public.circles from anon, authenticated;
-- And any column-level grant on them that predates this file.
revoke select (latitude, longitude, location, area_offset_north_m, area_offset_east_m)
  on public.circles from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'circles'
     and column_name not in (
       'latitude', 'longitude', 'location',
       'area_offset_north_m', 'area_offset_east_m'
     );

  execute format('grant select (%s) on public.circles to anon, authenticated', cols);
end $$;

-- ---------------------------------------------------------------------------
-- Post-conditions. Checked against the privilege catalogue rather than
-- assumed, because the failure mode is silent.
-- ---------------------------------------------------------------------------
do $$
declare
  r text;
  c text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    -- A surviving table-level grant would make every column revoke inert.
    if has_table_privilege(r, 'public.circles', 'select') then
      raise exception '% still holds table-level SELECT on circles', r;
    end if;

    foreach c in array array['latitude', 'longitude', 'location', 'area_offset_north_m', 'area_offset_east_m'] loop
      if has_column_privilege(r, 'public.circles', c, 'select') then
        raise exception '% can still read circles.%', r, c;
      end if;
    end loop;

    foreach c in array array['id', 'name', 'visibility', 'neighborhood', 'area_latitude', 'area_longitude'] loop
      if not has_column_privilege(r, 'public.circles', c, 'select') then
        raise exception '% lost circles.%, which the app reads', r, c;
      end if;
    end loop;
  end loop;

  -- Writes are untouched: creating and editing a circle still sets the point.
  if not has_column_privilege('authenticated', 'public.circles', 'latitude', 'insert')
     or not has_column_privilege('authenticated', 'public.circles', 'latitude', 'update') then
    raise exception 'authenticated can no longer write circles.latitude';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
