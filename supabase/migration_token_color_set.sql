-- ============================================================
-- BattleCards — named color_set property for tokens + trackers
-- Paste this into the Supabase SQL editor and run it.
--
-- Adds a `color_set` text column on token_definitions. When set, the
-- renderer resolves it against a fixed palette (see
-- src/lib/tokenColorSets.ts) into a two-state set:
--
--   • active   — bg = shade-700, stroke = shade-500, text = white
--   • inactive — bg = shade-950, stroke = shade-800, text = shade-800
--
-- Used by:
--   • Bar-style trackers (display_style='bar'): inactive properties paint
--     the container/background, active properties paint the filled bar
--     and its centred number. The cap label at the top uses inactive
--     text colour so it reads against the dark container.
--   • Badge-style tokens (display_style='badge', future migration) will
--     similarly use active for "on" and inactive for "off".
--
-- Recognised names mirror the Tailwind palette: Red, Orange, Amber,
-- Yellow, Green, Teal, Blue, Purple, Pink, Slate. Case-insensitive.
-- Unknown names fall back to deriving the palette from `display_color`,
-- so it's safe to misspell.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.token_definitions
  add column if not exists color_set text;

-- ── Switch KT Wound to the Green color set ────────────────────────────
-- Clears `display_color` so the renderer routes through the named
-- palette resolver rather than the hex-derivation fallback. The Green
-- palette's shade-700 fill is slightly darker than the previous
-- green-600 hex; matches the active-token contract.
update public.token_definitions td
set color_set     = 'Green',
    display_color = null
from public.games g
where td.game_id = g.id
  and g.slug = 'kill-team'
  and td.name = 'Wound';
