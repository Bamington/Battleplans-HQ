-- ============================================================
-- BattleCards — Kill Team token definitions
-- Paste this into the Supabase SQL editor and run it.
--
-- Seeds Play-mode token definitions for the Kill Team game. Each row drives:
--   • a button in the carousel's TokenMenu dropdown,
--   • an icon painted on the card via TokenOverlay,
--   • optional New-Turn refresh behaviour (Activated flips back to ready).
--
-- Run this AFTER `migration_tokens.sql` (which creates the table),
-- `migration_tokens_refresh_on_turn.sql` (which adds refresh columns), and
-- `migration_kill_team.sql` (which inserts the kill-team game row).
--
-- Idempotent: the table has `unique (game_id, name)`, so this uses ON
-- CONFLICT DO NOTHING. Re-running won't duplicate rows.
-- ============================================================

insert into public.token_definitions
  (game_id, name, description, icon, icon_off, is_toggle,
   keyword_name, keyword_value_role, stat_key, stat_role,
   starting_value, min_value, max_value,
   refresh_on_turn, is_activation_token, sort_order)
select
  g.id,
  v.name, v.description,
  v.icon, v.icon_off, v.is_toggle,
  v.keyword_name, v.keyword_value_role, v.stat_key, v.stat_role,
  v.starting_value, v.min_value, v.max_value,
  v.refresh_on_turn, v.is_activation_token, v.sort_order
from public.games g,
(values
  -- Wounds taken — stacking counter capped by the card's `wounds` stat.
  ('Wound',     'Tracks wounds taken by the operative.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Wound, State=Default.svg',
   null::text, false,
   null::text, null::text,
   'wounds', 'max'::text,
   0, 0, null::int,
   0, false, 1),

  -- Order — single toggle: off = Conceal (default), on = Engage.
  ('Order',     'Operative''s order: Conceal (off) or Engage (on).',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Order, State=Default.svg',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Order, State=Off.svg',
   true,
   null::text, null::text,
   null::text, null::text,
   0, 0, 1,
   0, false, 2),

  -- Activated — single toggle. starting_value = 0 means operatives come
  -- up "ready / not yet activated" at the start of each turn. Clicking
  -- "Mark Activated" sets current=1. New Turn applies refresh_on_turn=-1
  -- to walk activated units back to 0 (ready) — units already at 0 stay
  -- at 0 (min clamp).
  ('Activated', 'Indicates the operative has been activated this turn.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Activated, State=Default.svg',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Activated, State=Off.svg',
   true,
   null::text, null::text,
   null::text, null::text,
   0, 0, 1,
   -1, true, 5),

  -- Status tokens (single-instance toggles)
  ('Stun',      'The operative is stunned.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Stun, State=Default.svg',
   null::text, false,
   null::text, null::text,
   null::text, null::text,
   null::int, 0, 1,
   0, false, 6),

  ('Pinned',    'The operative is pinned.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Pinned, State=Default.svg',
   null::text, false,
   null::text, null::text,
   null::text, null::text,
   null::int, 0, 1,
   0, false, 7),

  -- Poison — stacking counter (no max).
  ('Poison',    'Stacking poison counters on the operative.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Poison, State=Default.svg',
   null::text, false,
   null::text, null::text,
   null::text, null::text,
   0, 0, null::int,
   0, false, 8)
) as v(name, description, icon, icon_off, is_toggle,
       keyword_name, keyword_value_role, stat_key, stat_role,
       starting_value, min_value, max_value,
       refresh_on_turn, is_activation_token, sort_order)
where g.slug = 'kill-team'
on conflict (game_id, name) do nothing;
