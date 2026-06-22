-- ============================================================
-- BattleCards — Repent Ye Foolish Gods seed migration
-- Adds RYG as a new supported game.
--
-- Covers:
--   1. public.games            — new row with stat_schema + print sizes
--   2. public.addon_types      — weapons, armor, items, special-ability
--   3. public.game_constraints — card, addon, and keyword validation rules
--
-- Card size matches Kill Team portrait orientation: 89×127 mm print,
-- 95×133 mm bleed (landscape mm values swapped to portrait).
-- ============================================================


-- ── Seed: games ──────────────────────────────────────────────────────────────

-- Warrior stats:
--   type    — string (e.g. "Bastard", "Knight")
--   sept    — string (e.g. "Sept of the Star")
--   offense — number
--   defense — number
--   life    — number
--   tactics — number
--   fate    — number
--
-- Talents (keywords) attach via card_keywords.
-- Special ability attaches via card_addons (addon_type slug = 'special-ability').
-- Equipment (weapons, armor, items) attach via card_addons.

insert into public.games (name, slug, stat_schema, print_size, bleed_size, status) values (
  'Repent Ye Foolish Gods',
  'ryg',
  '[
    {"key": "type",    "label": "Type",    "type": "text"},
    {"key": "sept",    "label": "Sept",    "type": "text"},
    {"key": "offense", "label": "Offense", "type": "number"},
    {"key": "defense", "label": "Defense", "type": "number"},
    {"key": "life",    "label": "Life",    "type": "number"},
    {"key": "tactics", "label": "Tactics", "type": "number"},
    {"key": "fate",    "label": "Fate",    "type": "number"}
  ]'::jsonb,
  '[89, 127]'::jsonb,
  '[95, 133]'::jsonb,
  'draft'
);


-- ── Seed: addon_types ────────────────────────────────────────────────────────

-- Special Ability — one per warrior; name comes from the addon name field,
-- description comes from the addon description field. No extra stats.
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Special Ability', 'special-ability', '[]'::jsonb
from public.games where slug = 'ryg';

-- Weapons — name from addon name, damage is a free-text die spec (e.g. "1D6+3"),
-- range in inches (0 = melee, rendered as "—"). Keywords attach via addon_keywords.
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "damage", "label": "Damage", "type": "text"},
    {"key": "range",  "label": "Range",  "type": "number"}
  ]'::jsonb
from public.games where slug = 'ryg';

-- Armor — name from addon name, description from addon description. No extra stats.
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Armor', 'armor', '[]'::jsonb
from public.games where slug = 'ryg';

-- Items — name from addon name, description from addon description. No extra stats.
insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Items', 'items', '[]'::jsonb
from public.games where slug = 'ryg';


-- ── Seed: game_constraints ───────────────────────────────────────────────────

-- Card constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'card', null, '{
  "fields": {
    "name":           { "required": true, "maxLength": 60 },
    "stats.type":     { "maxLength": 40 },
    "stats.sept":     { "maxLength": 60 },
    "stats.offense":  { "min": 0, "max": 99 },
    "stats.defense":  { "min": 0, "max": 99 },
    "stats.life":     { "min": 0, "max": 99 },
    "stats.tactics":  { "min": 0, "max": 99 },
    "stats.fate":     { "min": 0, "max": 99 }
  },
  "limits": {
    "maxKeywords": 20
  }
}'::jsonb
from public.games g where g.slug = 'ryg';

-- Keyword constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'keyword', null, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g where g.slug = 'ryg';

-- Special Ability constraints (1 per card max enforced in frontend)
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":        { "required": true, "maxLength": 60 },
    "description": { "maxLength": 2000 }
  },
  "limits": {
    "maxPerCard": 1
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'special-ability'
where g.slug = 'ryg';

-- Weapon constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":         { "required": true, "maxLength": 40 },
    "stats.damage": { "maxLength": 20 },
    "stats.range":  { "min": 0, "max": 999 }
  },
  "limits": {
    "maxKeywords": 10
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'weapons'
where g.slug = 'ryg';

-- Armor constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'armor'
where g.slug = 'ryg';

-- Item constraints
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":        { "required": true, "maxLength": 40 },
    "description": { "maxLength": 500 }
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'items'
where g.slug = 'ryg';
