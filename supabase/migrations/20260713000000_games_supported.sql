-- 20260713000000_games_supported.sql
--
-- Flag which games we fully support. `true` for the curated set we build tools
-- around; `false` for games a user has only logged battles against (e.g. board
-- games / TCGs imported from a personal tracker). `created_by` already exists.
--
-- A later change will gate the game picker to supported games OR games the
-- current user created themselves.

alter table public.games
  add column if not exists supported boolean not null default true;
