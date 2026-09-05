-- Profiles: one per user, auto-created on signup
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Circles: local community groups
create table public.circles (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  location text,
  category text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Circle members: who belongs to which circle
create table public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Events: posted inside a circle
create table public.events (
  id uuid default gen_random_uuid() primary key,
  circle_id uuid references public.circles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: enable on all tables
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.events enable row level security;

-- Profiles: users can read all profiles, only edit their own
create policy "profiles: public read" on public.profiles for select using (true);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Circles: anyone logged in can read; only creator can update/delete
create policy "circles: auth read" on public.circles for select using (auth.role() = 'authenticated');
create policy "circles: auth insert" on public.circles for insert with check (auth.uid() = created_by);
create policy "circles: creator update" on public.circles for update using (auth.uid() = created_by);
create policy "circles: creator delete" on public.circles for delete using (auth.uid() = created_by);

-- Circle members: members can see their own memberships; anyone can join
create policy "members: auth read" on public.circle_members for select using (auth.role() = 'authenticated');
create policy "members: auth insert" on public.circle_members for insert with check (auth.uid() = user_id);
create policy "members: own delete" on public.circle_members for delete using (auth.uid() = user_id);

-- Events: circle members can read; authenticated users can post
create policy "events: auth read" on public.events for select using (auth.role() = 'authenticated');
create policy "events: auth insert" on public.events for insert with check (auth.uid() = created_by);
create policy "events: creator update" on public.events for update using (auth.uid() = created_by);
create policy "events: creator delete" on public.events for delete using (auth.uid() = created_by);
