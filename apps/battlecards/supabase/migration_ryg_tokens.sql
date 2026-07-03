-- RYG token_definitions seed
-- Tokens for Repent Ye Foolish Gods play mode.
--
-- Life bar:   damage counter capped by the card's `life` stat → shown as a
--             horizontal bar below the card (display_style='bar').
-- Activated:  single toggle; refresh_on_turn=-1 resets at New Round.
-- Bleeding:   stacking counter (no max); affects Defense each round.
-- Immobilized / Poisoned / Slowed: single on/off toggles.

-- Patch existing rows with display_color and display_glyph.
update public.token_definitions td
set
  display_color = v.display_color,
  display_glyph = v.display_glyph,
  display_style = v.display_style,
  stat_key      = v.stat_key,
  stat_role     = v.stat_role,
  is_toggle     = v.is_toggle,
  refresh_on_turn     = v.refresh_on_turn,
  is_activation_token = v.is_activation_token,
  sort_order    = v.sort_order
from public.games g,
(values
  ('Life',        'life', 'max'::text, false, 'bar'::text,   '#22c55e'::text, null::text,  0, false, 1),
  ('Activated',   null::text, null::text, true, 'badge'::text,  '#22c55e'::text, 'AC'::text, -1, true,  2),
  ('Bleeding',    null::text, null::text, false, 'badge'::text, '#ef4444'::text, 'BL'::text,  0, false, 3),
  ('Immobilized', null::text, null::text, true,  'badge'::text, '#3b82f6'::text, 'IM'::text,  0, false, 4),
  ('Poisoned',    null::text, null::text, true,  'badge'::text, '#a855f7'::text, 'PO'::text,  0, false, 5),
  ('Slowed',      null::text, null::text, true,  'badge'::text, '#f59e0b'::text, 'SL'::text,  0, false, 6)
) as v(name, stat_key, stat_role, is_toggle, display_style,
       display_color, display_glyph,
       refresh_on_turn, is_activation_token, sort_order)
where g.slug = 'ryg'
  and td.game_id = g.id
  and td.name    = v.name;
