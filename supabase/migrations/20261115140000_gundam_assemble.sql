-- Already applied to the live database on 2026-11 from the standalone BattleCards repo
-- (supabase/migration_gundam_assemble.sql); recorded here with 'supabase migration repair'.

-- ============================================================
-- BattleCards — Gundam Assemble seed migration (List Builder game)
--
-- Run AFTER migration_card_faces.sql.
--
-- Covers:
--   1. public.games             — fills in the existing shared catalog row
--   2. public.token_definitions — HP bar + Activated badge (no artwork needed;
--                                 uses the bar/badge display styles RYG uses)
--   3. public.packs             — empty official "Starter Set" pack owned by
--                                 the first admin
--
-- There is no custom builder page for this game, so decks open in the
-- generic ListBuilder (src/pages/DeckPage.tsx falls back to it).
--
-- Card size: official unit cards are 150×105 mm (landscape), 3 mm bleed.
--
-- Cards are NOT seeded here: each needs its official card face uploaded to
-- card-images/packs/{pack_id}/… first. See the template at the bottom.
-- ============================================================


-- ── 1. Game ─────────────────────────────────────────────────────────────────
-- The games table is a catalog shared with Battleplan and already contains a
-- 'gundam-assemble' row (with empty stat_schema / print sizes), so this
-- UPDATES that row rather than inserting. battlecards_status stays 'draft'
-- (admins/testers only) until the pack has cards.
--
-- Unit stats used by play mode:
--   hp       — max HP; the HP bar token is capped by it
--   vp       — victory points the unit is worth
--   timeline — starting timeline value
-- Tactics cards (card_type 'rule') carry no stats.

update public.games
set
  stat_schema = '[
    {"key": "hp",       "label": "HP",                "type": "number"},
    {"key": "vp",       "label": "VP",                "type": "number"},
    {"key": "timeline", "label": "Starting Timeline", "type": "number"}
  ]'::jsonb,
  print_size = '[150, 105]'::jsonb,
  bleed_size = '[156, 111]'::jsonb
where slug = 'gundam-assemble'
  and coalesce(jsonb_array_length(stat_schema), 0) = 0;   -- don't clobber later edits


-- ── 2. Tokens ───────────────────────────────────────────────────────────────
-- HP:        damage counter capped by the card's `hp` stat, shown as a bar
--            beneath the card.
-- Activated: single toggle; New Turn (refresh_on_turn = -1) resets it.

insert into public.token_definitions
  (game_id, name, description, icon, icon_off, is_toggle,
   keyword_name, keyword_value_role, stat_key, stat_role,
   starting_value, min_value, max_value,
   refresh_on_turn, is_activation_token,
   display_style, display_color, display_glyph, sort_order)
select
  g.id, v.name, v.description, null, null, v.is_toggle,
  null, null, v.stat_key, v.stat_role,
  v.starting_value, 0, v.max_value,
  v.refresh_on_turn, v.is_activation_token,
  v.display_style, v.display_color, v.display_glyph, v.sort_order
from public.games g,
(values
  ('HP',        'Damage taken by the unit.',          false, 'hp'::text,   'max'::text, 0, null::int,  0, false, 'bar'::text,   '#22c55e'::text, null::text,  1),
  ('Activated', 'The unit has activated this turn.',  true,  null::text,   null::text,  0, 1,         -1, true,  'badge'::text, '#22c55e'::text, 'AC'::text,  2)
) as v(name, description, is_toggle, stat_key, stat_role,
       starting_value, max_value, refresh_on_turn, is_activation_token,
       display_style, display_color, display_glyph, sort_order)
where g.slug = 'gundam-assemble'
  and not exists (
    select 1 from public.token_definitions td
    where td.game_id = g.id and td.name = v.name
  );


-- ── 3. Official pack ────────────────────────────────────────────────────────
-- Owned by the first admin so they can upload faces into packs/{pack_id}/.
-- Official packs are auto-imported when a user creates a deck for the game.

insert into public.packs (owner_user_id, game_id, name, description, is_public, is_official)
select
  (select id from public.user_profiles where role = 'admin' order by created_at limit 1),
  g.id,
  'Gundam Assemble Starter Set',
  'Official unit and tactics cards from the Starter Set.',
  false,   -- private until its cards are loaded; flip to public at launch
  true
from public.games g
where g.slug = 'gundam-assemble'
  and not exists (
    select 1 from public.packs p where p.game_id = g.id and p.is_official
  );


-- ── Template: adding a card to the official pack ────────────────────────────
-- 1. Upload the face image to the card-images bucket at
--      packs/<pack id>/<file name>.png
-- 2. Insert the card (operative = unit, rule = tactics):
--
-- insert into public.cards (user_id, game_id, pack_id, is_template, name, card_type, stats, face_path)
-- select p.owner_user_id, p.game_id, p.id, true,
--        '<Card name>', 'operative',
--        '{"hp": 0, "vp": 0, "timeline": 0}'::jsonb,
--        'packs/' || p.id || '/<file name>.png'
-- from public.packs p
-- join public.games g on g.id = p.game_id
-- where g.slug = 'gundam-assemble' and p.is_official;
