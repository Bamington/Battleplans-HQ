-- ============================================================
-- BattleCards — StarCraft seed migration
-- Adds StarCraft as a new supported game.
--
-- Covers:
--   1. public.games            — new row with stat_schema + print sizes
--   2. public.addon_types      — 'weapons' and 'rules' addon categories
--   3. public.game_constraints — card, rule, weapon-addon, rule-addon,
--                                and keyword validation rules
--
-- Assumes migration_addon_hierarchy.sql has already been applied, since
-- StarCraft weapon upgrades rely on card_addons.parent_card_addon_id.
--
-- Card size matches Halo (landscape 127×89 mm print, 133×95 mm bleed).
-- Faction colour theming (Terran / Zerg / Protoss) is handled in the
-- frontend; v1 ships Terran only.
-- ============================================================


-- ── Seed: games ──────────────────────────────────────────────────────────────

-- Core stats shown on every unit card:
--   speed, evade, armour, hit_points, size
-- Die thresholds (evade, armour) are stored as numbers — the card formats
-- them as "{n}+" at render time.
--
-- The required *Unit Type* (e.g. "Marines") lives on cards.name (the
-- existing required column). The optional *Unit Name* (e.g. "Jim Raynor",
-- for hero / named units) lives in cards.stats.unitName.
--
-- supply_tiers is a flexible array of { min_models, max_models, supply }
-- rows (1–3 entries), not a fixed-shape scalar.  Stored as JSON inside
-- cards.stats — the stat_schema lists it as type "text" only so the
-- generic constraint engine ignores it (structured validation lives in
-- the frontend).
--
-- tags is free-text for v1 (e.g. "Core, Light, Biological, Ground, Terran").

insert into public.games (name, slug, stat_schema, print_size, bleed_size) values (
  'StarCraft',
  'starcraft',
  '[
    {"key": "unitName",     "label": "Unit Name",       "type": "text"},
    {"key": "speed",        "label": "Speed",           "type": "number"},
    {"key": "evade",        "label": "Evade",           "type": "number"},
    {"key": "armour",       "label": "Armour",          "type": "number"},
    {"key": "hitPoints",    "label": "Hit Points",      "type": "number"},
    {"key": "size",         "label": "Size",            "type": "number"},
    {"key": "pointsCost",   "label": "Points Cost",     "type": "number"},
    {"key": "supplyTiers",  "label": "Models / Supply", "type": "text"},
    {"key": "tags",         "label": "Tags",            "type": "text"}
  ]'::jsonb,
  '[127, 89]'::jsonb,
  '[133, 95]'::jsonb
);


-- ── Seed: addon_types ────────────────────────────────────────────────────────

-- Weapons — reusable per-game library item. Attached to cards via card_addons.
-- Both `phase` (turn phase) and `state` (activation) are optional and apply
-- to weapons and abilities alike.
-- "phase":   'movement' | 'assault' | 'combat' | 'special_abilities' | null
--            (where the addon lives on the card).
-- "state":   'active' | 'passive' | 'reaction' | null
--            (the coloured chip drawn next to the addon's name).
-- "range":   number (inches; melee = 0).
-- "hit":     number (target value rendered as "{n}+").
-- "sDice":   text — supports values like "D3+1" the user types as a die spec.
-- Upgrade nesting is recorded via addons.parent_addon_id (one level deep).
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "phase",     "label": "Phase",      "type": "text"},
    {"key": "timing",    "label": "Timing",     "type": "text"},
    {"key": "range",     "label": "Range",      "type": "number"},
    {"key": "roa",       "label": "RoA",        "type": "number"},
    {"key": "hit",       "label": "Hit",        "type": "number"},
    {"key": "dmg",       "label": "Damage",     "type": "number"},
    {"key": "surgeType", "label": "Surge Type", "type": "text"},
    {"key": "sDice",     "label": "Surge Dice", "type": "text"}
  ]'::jsonb
from public.games where slug = 'starcraft';

-- Rules (abilities) — reusable per-game library item.
-- Same `phase` + `timing` enums as weapons. Phase is required for abilities;
-- timing is optional. Abilities also carry `cpCost` (resource — CP / BM /
-- Energy) and `upgradeCost` (mineral cost, only meaningful when isUpgrade).
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Rules', 'rules',
  '[
    {"key": "phase",       "label": "Phase",        "type": "text"},
    {"key": "timing",      "label": "Timing",       "type": "text"},
    {"key": "cpCost",      "label": "Resource Cost","type": "number"},
    {"key": "isUpgrade",   "label": "Is Upgrade",   "type": "text"},
    {"key": "upgradeCost", "label": "Upgrade Cost", "type": "number"},
    {"key": "description", "label": "Description",  "type": "text"}
  ]'::jsonb
from public.games where slug = 'starcraft';


-- ── Seed: game_constraints ───────────────────────────────────────────────────

-- Card constraints
-- maxAddons is intentionally generous: a card can carry many rules (across
-- four phase buckets) and multiple weapons (with children).  If a hard cap
-- is desired later, tighten this here.
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":               { "required": true, "maxLength": 40 },
    "stats.unitName":     { "maxLength": 40 },
    "stats.speed":        { "min": 0, "max": 20 },
    "stats.evade":        { "min": 0, "max": 9 },
    "stats.armour":       { "min": 0, "max": 9 },
    "stats.hitPoints":    { "min": 0, "max": 99 },
    "stats.size":         { "min": 0, "max": 9 },
    "stats.pointsCost":   { "min": 0, "max": 9999 },
    "stats.tags":         { "maxLength": 200 }
  },
  "limits": {
    "maxKeywords": 20
  }
}'::jsonb
from public.games g where g.slug = 'starcraft';

-- Keyword constraints (parallels Halo / Blood Bowl)
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'starcraft';

-- Rule constraints (deck-scoped rule cards — matches Halo)
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'rule', null, '{
  "fields": {
    "title":       { "required": true, "maxLength": 60 },
    "description": { "maxLength": 2000 }
  }
}'::jsonb
from public.games g where g.slug = 'starcraft';

-- Weapon addon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
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
  "limits": {
    "maxKeywords": 10
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'weapons'
where g.slug = 'starcraft';

-- Rule (ability) addon constraints — reusable per-game library items.
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 40 },
    "stats.phase":       { "maxLength": 20 },
    "stats.timing":      { "maxLength": 12 },
    "stats.cpCost":      { "min": 0, "max": 99 },
    "stats.upgradeCost": { "min": 0, "max": 9999 },
    "stats.description": { "maxLength": 500 }
  },
  "limits": {
    "maxKeywords": 5
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'rules'
where g.slug = 'starcraft';
