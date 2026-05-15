-- ============================================================
-- BattleCards — token display style (icon / badge / bar / pips)
-- Paste this into the Supabase SQL editor and run it.
--
-- Introduces a per-token `display_style` discriminator on
-- `token_definitions` so each token row picks its presentation
-- without the renderer having to infer it from other columns:
--
--   • 'icon'  (default) — built-in SVG asset path in `icon` / `icon_off`,
--                         e.g. Halo's Damage / Shield / Activated.
--   • 'badge'           — coloured-circle UCTs (User-Created Tokens),
--                         rendered with display_color + display_glyph.
--   • 'bar'             — vertical bar with a single centred number for
--                         the remaining amount. Used for stat-linked
--                         counters where a stack of icons isn't ideal
--                         (e.g. KT Wound with 20 max).
--   • 'pips'            — reserved for future use; column accepts the
--                         value but no renderer is wired yet.
--
-- This pass also flips KT's built-in `Wound` token to 'bar' and gives
-- it a display_color so the bar has a fill colour (filled = remaining;
-- empty = same colour at low alpha).
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Column ─────────────────────────────────────────────────────────────

alter table public.token_definitions
  add column if not exists display_style text not null default 'icon';

-- Add the check constraint only if it doesn't already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.token_definitions'::regclass
      and conname  = 'token_definitions_display_style_check'
  ) then
    alter table public.token_definitions
      add constraint token_definitions_display_style_check
      check (display_style in ('icon', 'badge', 'bar', 'pips'));
  end if;
end $$;

-- ── Backfill UCTs → 'badge' ────────────────────────────────────────────
-- Any existing row with `display_color` set was a deck-scoped UCT.
-- They've been rendering as badges all along; make that explicit so the
-- renderer can route purely off display_style going forward.
update public.token_definitions
set display_style = 'badge'
where display_color is not null
  and display_style = 'icon';

-- ── Switch KT Wound to 'bar' + give it a fill colour ───────────────────
-- The renderer derives the bar's background (~green-950) and stroke
-- (~green-800) from this fill colour, so storing just the fill keeps
-- the schema simple. Tweak the hex if the brand palette evolves.
update public.token_definitions td
set display_style = 'bar',
    display_color = '#16a34a'  -- green-600 (fill)
from public.games g
where td.game_id = g.id
  and g.slug = 'kill-team'
  and td.name = 'Wound';
