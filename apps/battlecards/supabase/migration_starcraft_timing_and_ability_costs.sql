-- ============================================================
-- BattleCards — StarCraft: rename `state` → `timing` + add ability
-- upgrade-cost fields.
--
-- Two changes:
--   1. Rename the activation field from `state` → `timing` on every
--      StarCraft addon (weapons + rules). The field is the chip drawn
--      next to an addon's name (Active / Passive / Reaction).
--   2. Add new ability-only fields:
--        • `isUpgrade`   — boolean, gates the Upgrade Cost UI on the form
--        • `upgradeCost` — number, mineral cost for upgrade abilities
--
-- Both changes update:
--   • addon_types.stat_schema for weapons + rules
--   • game_constraints for the same
--   • existing addon rows (rename stats.state → stats.timing)
--
-- Idempotent — running twice is harmless.
-- ============================================================

-- ── 1. Rewrite addon_types.stat_schema ──────────────────────────────────────

update public.addon_types
   set stat_schema = '[
     {"key": "phase",     "label": "Phase",      "type": "text"},
     {"key": "timing",    "label": "Timing",     "type": "text"},
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
     {"key": "phase",       "label": "Phase",        "type": "text"},
     {"key": "timing",      "label": "Timing",       "type": "text"},
     {"key": "cpCost",      "label": "Resource Cost","type": "number"},
     {"key": "isUpgrade",   "label": "Is Upgrade",   "type": "text"},
     {"key": "upgradeCost", "label": "Upgrade Cost", "type": "number"},
     {"key": "description", "label": "Description",  "type": "text"}
   ]'::jsonb
 where slug = 'rules'
   and game_id = (select id from public.games where slug = 'starcraft');


-- ── 2. Rewrite game_constraints for both addon types ────────────────────────

update public.game_constraints
   set constraints = '{
     "fields": {
       "name":             { "required": true, "maxLength": 40 },
       "stats.phase":      { "maxLength": 20 },
       "stats.timing":     { "maxLength": 12 },
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
       "stats.timing":      { "maxLength": 12 },
       "stats.cpCost":      { "min": 0, "max": 99 },
       "stats.upgradeCost": { "min": 0, "max": 9999 },
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


-- ── 3. Migrate existing addon rows: stats.state → stats.timing ──────────────
-- Applies to every StarCraft addon (weapons + rules) that still has a
-- `state` key. The trigger on addons re-validates against the new
-- constraints, but since both `state` and `timing` use the same value
-- domain (active / passive / reaction), the data passes either way.

update public.addons a
   set stats = (a.stats - 'state') || jsonb_build_object('timing', a.stats -> 'state')
  from public.addon_types at
  join public.games g on g.id = at.game_id
 where a.addon_type_id = at.id
   and g.slug = 'starcraft'
   and a.stats ? 'state';
