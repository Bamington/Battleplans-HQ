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

  -- Activated — single toggle. On at start of turn, off when activated.
  -- Wait — we want Activated to behave like Halo's: starts on (ready),
  -- player flips it off when they activate. refresh_on_turn = -1 walks it
  -- back from ready (1) to activated (0)? No: in Halo, starting_value=1,
  -- "all activated" means all === max (which is 1). refresh_on_turn=-1
  -- moves them from 1 → 0 each turn. Hmm — let me match Halo's semantics:
  -- starting_value=1 (ready), max=1, refresh=-1 so New Turn marks everyone
  -- ready again after each turn (because allActivated triggers a turn
  -- where current >= max, so refresh -1 moves them all to 0… reading the
  -- code: handleNewTurn applies refresh_on_turn delta clamped. With
  -- starting=1, refresh=-1, current=1, new value=0. So token starts
  -- "Ready" (1), player toggles to "Activated" (0), end of turn the
  -- player hits New Turn which sets them back to 1.
  -- But Halo's Activated has starting=1 and the "Mark Activated"/"Mark
  -- Ready" labels flip based on isOn. Whatever the convention says, the
  -- TokenMenu UX is fine. Keep parity with Halo.
  ('Activated', 'Indicates the operative has been activated this turn.',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Activated, State=Default.svg',
   'src/assets/games/card assets/kill-team/tokens/Token Type=Activated, State=Off.svg',
   true,
   null::text, null::text,
   null::text, null::text,
   1, 0, 1,
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
