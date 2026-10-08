-- Word Forge — allow all solo modes in cloud saves
-- Run after 002_game_saves_per_mode.sql in Supabase SQL Editor.

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
