-- ============================================================
-- BattleCards — Blood Bowl token definitions
-- Paste this into the Supabase SQL editor and run it.
--
-- Seeds Play-mode token definitions for the Blood Bowl game. Blood Bowl has no
-- token icon art yet, so these render as coloured badges (display_style='badge'
-- with a short glyph) rather than icon overlays.
--
-- Initial set (more will be added later):
--   • Knocked Out — single on/off toggle (min 0, max 1).
--   • Casualty    — single on/off toggle (min 0, max 1).
-- Neither refreshes on New Turn and neither is an activation token.
--
-- Run this AFTER `migration_tokens.sql` (creates the table),
-- `migration_tokens_refresh_on_turn.sql`, `migration_token_display_style.sql`,
-- `migration_token_color_set.sql` (display_color / display_glyph), and
-- the migration that inserts the blood-bowl game row.
--
-- Idempotent WITHOUT relying on ON CONFLICT: `token_definitions`' unique
-- constraint was replaced by partial indexes (migration_custom_tokens_unique.sql),
-- which an `on conflict (game_id, name)` target can't reliably match. Instead we
-- guard each row with `NOT EXISTS`, so re-running simply inserts nothing.
-- ============================================================

insert into public.token_definitions
  (game_id, name, description, icon, icon_off, is_toggle,
   keyword_name, keyword_value_role, stat_key, stat_role,
   starting_value, min_value, max_value,
   refresh_on_turn, is_activation_token,
   display_style, display_color, display_glyph, sort_order)
select
  g.id,
  v.name, v.description,
  null::text, null::text, v.is_toggle,
  null::text, null::text, null::text, null::text,
  v.starting_value, v.min_value, v.max_value,
  v.refresh_on_turn, v.is_activation_token,
  v.display_style, v.display_color, v.display_glyph, v.sort_order
from public.games g,
(values
  ('Knocked Out', 'The player is knocked out.',
   true, 0, 0, 1, 0, false, 'badge'::text, '#f59e0b'::text, 'KO'::text, 1),

  ('Casualty',    'The player is a casualty.',
   true, 0, 0, 1, 0, false, 'badge'::text, '#ef4444'::text, 'CA'::text, 2)
) as v(name, description, is_toggle,
       starting_value, min_value, max_value,
       refresh_on_turn, is_activation_token,
       display_style, display_color, display_glyph, sort_order)
where g.slug = 'blood-bowl'
  and not exists (
    select 1 from public.token_definitions td
    where td.game_id = g.id
      and td.name    = v.name
      and td.deck_id is null
  );
