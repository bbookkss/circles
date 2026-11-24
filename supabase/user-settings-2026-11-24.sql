-- ---------------------------------------------------------------------------
-- Per-person settings that follow them across devices. 2026-11-24
--
-- First setting: light or dark. Null means "follow the device".
--
-- Its own table rather than a profiles column because signed-in users can
-- read every profile row, and nobody needs to see anyone else's settings.
-- Own row only: read, insert, update. Idempotent.
-- ---------------------------------------------------------------------------

begin;

create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  theme      text check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update on table public.user_settings to authenticated;

drop policy if exists "settings: own row" on public.user_settings;
create policy "settings: own row" on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if has_table_privilege('anon', 'public.user_settings', 'select') then
    raise exception 'post-condition: user_settings readable by anon';
  end if;
end $$;

commit;
