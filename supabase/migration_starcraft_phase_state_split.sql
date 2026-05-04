-- ============================================================
-- BattleCards — StarCraft: split addon `phase` into two fields.
-- Addons (weapons + abilities) now carry both:
--   • phase  — turn phase: 'movement' | 'assault' | 'combat' |
--              'special_abilities' | null  (where it lives on the card)
--   • state  — activation: 'active' | 'passive' | 'reaction' | null
--              (the coloured chip drawn next to the addon's name)
-- Both are optional and apply to weapons and abilities alike.
--
-- Previously only `phase` existed and meant different things on each
-- addon type (weapons used movement/assault/combat; abilities used
-- active/passive/reaction). This migration:
--   1. Rewrites addon_types stat_schemas to add `state`.
--   2. Updates game_constraints to allow longer `phase` values
--      ("special_abilities" is 17 chars) and validate `state`.
--   3. Migrates any existing data that still has the old `phase` enum:
--        • For weapons addons whose `stats.phase` is one of
--          movement/assault/combat — left in place (already valid).
--        • For rules (abilities) addons whose `stats.phase` is
--          active/passive/reaction — moved to `stats.state`, and
--          `stats.phase` cleared.
--      Anything else is left untouched.
--
-- Run after `migration_starcraft_weapons_modal.sql`. Fresh installs
-- get the same shape via the canonical `migration_starcraft.sql`.
-- ============================================================

-- ── 1. Update addon_types stat_schemas ──────────────────────────────────────

update public.addon_types
   set stat_schema = '[
     {"key": "phase",     "label": "Phase",      "type": "text"},
     {"key": "state",     "label": "State",      "type": "text"},
     {"key": "range",     "label": "Range",      "type": "number"},
     {"key": "roa",       "label": "RoA",        "type": "number"},
     {"key": "hit",       "label": "Hit",        "type": "number"},
     {"key": "dmg",       "label": "Damage",     "type": "number"},
     {"key": "surgeType", "label": "Surge Type", "type": "text"},
     {"key": "sDice",     "label": "Surge Dice", "type": "text"}
   ]'::jsonb
 where slug = 'weapons'
   and game_id = (select id from public.games where slug = 'starcraft');

update public.addon_types
   set stat_schema = '[
     {"key": "phase",       "label": "Phase",       "type": "text"},
     {"key": "state",       "label": "State",       "type": "text"},
     {"key": "cpCost",      "label": "CP Cost",     "type": "number"},
     {"key": "description", "label": "Description", "type": "text"}
   ]'::jsonb
 where slug = 'rules'
   and game_id = (select id from public.games where slug = 'starcraft');


-- ── 2. Update addon constraints ─────────────────────────────────────────────

update public.game_constraints
   set constraints = '{
     "fields": {
       "name":             { "required": true, "maxLength": 40 },
       "stats.phase":      { "maxLength": 20 },
       "stats.state":      { "maxLength": 12 },
       "stats.range":      { "min": 0, "max": 99 },
       "stats.roa":        { "min": 0, "max": 20 },
       "stats.hit":        { "min": 0, "max": 9 },
       "stats.dmg":        { "min": 0, "max": 20 },
       "stats.surgeType":  { "maxLength": 20 },
       "stats.sDice":      { "maxLength": 12 }
     },
     "limits": { "maxKeywords": 10 }
   }'::jsonb
 where addon_type_id = (
   select at.id
     from public.addon_types at
     join public.games g on g.id = at.game_id
    where g.slug = 'starcraft' and at.slug = 'weapons'
 );

update public.game_constraints
   set constraints = '{
     "fields": {
       "name":              { "required": true, "maxLength": 40 },
       "stats.phase":       { "maxLength": 20 },
       "stats.state":       { "maxLength": 12 },
       "stats.cpCost":      { "min": 0, "max": 9 },
       "stats.description": { "maxLength": 500 }
     },
     "limits": { "maxKeywords": 5 }
   }'::jsonb
 where addon_type_id = (
   select at.id
     from public.addon_types at
     join public.games g on g.id = at.game_id
    where g.slug = 'starcraft' and at.slug = 'rules'
 );


-- ── 3. Migrate existing rule addon data ─────────────────────────────────────
-- Move legacy active/passive/reaction values from stats.phase → stats.state
-- on `rules` addons. Weapon addons keep their movement/assault/combat phase
-- values untouched.

update public.addons a
   set stats = (a.stats - 'phase') || jsonb_build_object('state', a.stats ->> 'phase')
  from public.addon_types at
  join public.games g on g.id = at.game_id
 where a.addon_type_id = at.id
   and g.slug = 'starcraft'
   and at.slug = 'rules'
   and a.stats ->> 'phase' in ('active', 'passive', 'reaction');
