-- Word Forge: profiles + per-mode game saves (RLS, owner-only).
-- Project: nzklvxivpurprtysvqzw
-- Run once in Supabase Dashboard -> SQL Editor (or via the CLI).

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  theme text not null default 'system'
    check (theme in ('system', 'light', 'dark')),
  -- Player-wide progress: daily streak days, achievements, hint-free solves.
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One save per user per mode. `save` is the client's ModeSave JSON.
create table public.game_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null
    check (
      mode in (
        'forge', 'keystone', 'scramble', 'daily', 'define', 'ladder', 'affix',
        'rare', 'heat', 'echo', 'pin', 'pinDaily', 'wordle', 'wordleDaily',
        'pos', 'sense', 'inflect', 'synonym', 'antonym', 'blank', 'origin',
        'homophone', 'pronounce', 'register', 'kind', 'kin', 'relay', 'double',
        'trap', 'decoy', 'hunt'
      )
    ),
  save jsonb not null default '{}'::jsonb,
  save_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

create index game_saves_user_updated_idx
  on public.game_saves (user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "game_saves_select_own"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "game_saves_insert_own"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "game_saves_update_own"
  on public.game_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "game_saves_delete_own"
  on public.game_saves for delete
  using (auth.uid() = user_id);

-- Auto-create a profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, theme)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'system'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
