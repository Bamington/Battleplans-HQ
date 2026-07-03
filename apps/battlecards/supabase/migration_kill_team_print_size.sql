-- ============================================================
-- BattleCards — Kill Team print + bleed dimensions
-- Paste this into the Supabase SQL editor and run it.
--
-- Sets the kill-team game's `print_size` and `bleed_size` columns to the
-- standard "MTG-large" dimensions Halo also uses (127 × 89 mm print,
-- 133 × 95 mm bleed = 3 mm bleed on each edge). These are the dimensions
-- of OPERATIVE cards — the main game-piece layout. The matching bleed
-- background is `src/assets/games/card assets/kill-team/bg-print.svg`
-- (1330 × 950 px = 133 × 95 mm @ 10 px/mm).
--
-- ── Rule cards ──────────────────────────────────────────────────────────
-- Kill Team rule cards are a different shape: 70 × 120 mm print (76 × 126
-- mm bleed), portrait-oriented. The matching bleed background is
-- `bg-portrait-print.svg` (760 × 1260 px). Since the `games` table only
-- holds one print_size / bleed_size per game, rule-card dimensions live
-- in `src/components/PrintCardGrid.tsx` under `ITEM_PROFILE_OVERRIDES`
-- instead of the DB. If we ever need per-card-type sizes in the schema,
-- add a `card_type_dims` JSONB column to `games`.
--
-- Run this AFTER `migration_print_size.sql` (which adds the columns)
-- and `migration_kill_team.sql` (which inserts the kill-team row).
--
-- Idempotent — safe to re-run.
-- ============================================================

update public.games
set print_size = '[127, 89]'::jsonb,
    bleed_size = '[133, 95]'::jsonb
where slug = 'kill-team';
