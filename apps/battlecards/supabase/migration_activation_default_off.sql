-- ============================================================
-- BattleCards — activation tokens default to "off" (not activated)
-- Paste this into the Supabase SQL editor and run it.
--
-- Earlier seeds initialised activation tokens with `starting_value = 1`
-- so units came up as ALREADY activated on first entry to play mode —
-- the user then had to "Remove Activated" to mark them ready, which is
-- backwards from intuitive game UX.
--
-- This migration flips the default to 0 ("ready / not yet activated")
-- for every row marked is_activation_token. Combined with the existing
-- refresh_on_turn = -1, the New Turn handler still correctly resets
-- activated units back to 0 each turn — units at 0 just stay at 0 (the
-- min clamp).
--
-- Idempotent — safe to re-run.
-- ============================================================

update public.token_definitions
set starting_value = 0
where is_activation_token = true;
