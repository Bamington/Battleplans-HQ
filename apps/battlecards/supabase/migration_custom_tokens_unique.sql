-- ============================================================
-- BattleCards — token_definitions unique constraint fix
-- Paste this into the Supabase SQL editor and run it.
--
-- The original `unique (game_id, name)` on token_definitions (from
-- migration_tokens.sql) is too strict once we allow deck-scoped UCTs:
-- it blocks two different decks from ever using the same UCT name.
--
-- This migration replaces it with two partial unique indexes that match
-- our actual intent:
--
--   • Game tokens (deck_id IS NULL): at most one (game_id, name).
--     E.g. only one "Damage" token per game.
--
--   • Deck UCTs   (deck_id IS NOT NULL): at most one (deck_id, name).
--     E.g. deck A and deck B can each have their own "Charges" UCT,
--     but you can't create two "Charges" tokens inside deck A.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- Drop the original combined unique constraint if it still exists. The
-- index Postgres created for it goes with it.
alter table public.token_definitions
  drop constraint if exists token_definitions_game_id_name_key;

-- Game tokens — unique per (game_id, name) only when deck_id is null.
create unique index if not exists token_definitions_game_name_unique
  on public.token_definitions (game_id, name)
  where deck_id is null;

-- Deck UCTs — unique per (deck_id, name) for non-null deck_id.
create unique index if not exists token_definitions_deck_name_unique
  on public.token_definitions (deck_id, name)
  where deck_id is not null;
