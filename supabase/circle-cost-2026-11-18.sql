-- ---------------------------------------------------------------------------
-- Free or paid. 2026-11-18
--
-- Whether going to a circle costs money, so the map and lists can tell a free
-- run from a $7-cover game night at a glance.
--
--   is_free     true = free, false = costs something, null = not said yet
--               (every circle made before this). The app shows nothing for
--               null rather than guessing.
--   price_note  short and optional: "$7 cover", "$15 drop-in". Shown next to
--               the paid mark. Capped at 60 characters.
--
-- Both are public facts about a circle, like its name, so anon and
-- authenticated may read them. Since location-lockdown-2026-11-18.sql, SELECT
-- on circles is granted column by column, so a new column is unreadable until
-- it's named here (the trap PRODUCTION.md warns about). INSERT and UPDATE are
-- table-level grants and already cover new columns; RLS still decides who
-- may write which row.
-- ---------------------------------------------------------------------------

begin;

alter table public.circles add column if not exists is_free boolean;
alter table public.circles add column if not exists price_note text;

alter table public.circles drop constraint if exists circles_price_note_len;
alter table public.circles add constraint circles_price_note_len
  check (price_note is null or char_length(price_note) between 1 and 60);

grant select (is_free, price_note) on public.circles to anon, authenticated;

-- The eight SF events listed earlier today: one has a cover, the rest are free.
update public.circles set is_free = false, price_note = '$7 cover'
 where created_by = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3' and name = 'Board games with EGL';
update public.circles set is_free = true
 where created_by = '45d90d0c-7f6f-48fe-ac83-66fb49a2b4a3'
   and description like '%A public event listed on Circles.%'
   and name <> 'Board games with EGL';

do $$
begin
  if not has_column_privilege('anon', 'public.circles', 'is_free', 'select')
     or not has_column_privilege('authenticated', 'public.circles', 'price_note', 'select') then
    raise exception 'post-condition: cost columns are not readable';
  end if;
  -- The lockdown must still hold.
  if has_column_privilege('anon', 'public.circles', 'latitude', 'select') then
    raise exception 'post-condition: anon can read latitude';
  end if;
end $$;

commit;
