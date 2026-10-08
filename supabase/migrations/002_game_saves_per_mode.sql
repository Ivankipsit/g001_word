-- Word Forge — per-mode cloud saves (additive)
-- Run after 001_profiles_game_saves.sql in Supabase SQL Editor.
-- One row per (user_id, mode); switching modes never overwrites other modes.

-- Add mode column (existing rows become Forge)
alter table public.game_saves
  add column if not exists mode text;

update public.game_saves
set mode = 'forge'
where mode is null;

alter table public.game_saves
  alter column mode set default 'forge';

alter table public.game_saves
  alter column mode set not null;

-- Replace single-user PK with composite (user_id, mode)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'game_saves_pkey'
      and conrelid = 'public.game_saves'::regclass
  ) then
    alter table public.game_saves drop constraint game_saves_pkey;
  end if;
end $$;

alter table public.game_saves
  add constraint game_saves_pkey primary key (user_id, mode);

alter table public.game_saves
  drop constraint if exists game_saves_mode_check;

alter table public.game_saves
  add constraint game_saves_mode_check
  check (
    mode in (
      'forge',
      'keystone',
      'scramble',
      'daily',
      'define',
      'ladder',
      'affix',
      'rare',
      'heat',
      'echo'
    )
  );

create index if not exists game_saves_user_updated_idx
  on public.game_saves (user_id, updated_at desc);

-- RLS policies already scope by user_id; no change required for composite PK.
