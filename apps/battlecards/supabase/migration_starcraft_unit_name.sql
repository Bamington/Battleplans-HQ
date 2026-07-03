-- ============================================================
-- BattleCards — StarCraft: split Unit Type / Unit Name
-- Adds an optional `unitName` field to StarCraft cards, alongside
-- the existing required `cards.name` (which now represents the
-- *Unit Type* — e.g. "Marines", "Marauders").
--
-- Domain split:
--   • cards.name (existing required column)  — Unit TYPE,
--     the primary identifier shown prominently on the card.
--   • cards.stats.unitName (new, optional)   — Unit NAME,
--     for named / hero units (e.g. "Jim Raynor").
--
-- Also brings the StarCraft card constraints in line with the
-- frontend tweaks made alongside this rename:
--   • evade / armour are now numeric (0–9), not text
--   • a numeric pointsCost field exists (0–9999)
--
-- No table-shape change — everything is JSONB. Run this against DBs
-- that have already applied `migration_starcraft.sql`. Fresh installs
-- get the same shape via the canonical migration.
-- ============================================================

-- Replace the StarCraft stat_schema with the current shape.
update public.games
   set stat_schema = '[
     {"key": "unitName",     "label": "Unit Name",       "type": "text"},
     {"key": "speed",        "label": "Speed",           "type": "number"},
     {"key": "evade",        "label": "Evade",           "type": "number"},
     {"key": "armour",       "label": "Armour",          "type": "number"},
     {"key": "hitPoints",    "label": "Hit Points",      "type": "number"},
     {"key": "size",         "label": "Size",            "type": "number"},
     {"key": "pointsCost",   "label": "Points Cost",     "type": "number"},
     {"key": "supplyTiers",  "label": "Models / Supply", "type": "text"},
     {"key": "tags",         "label": "Tags",            "type": "text"}
   ]'::jsonb
 where slug = 'starcraft';

-- Replace the card constraints with the current shape.
update public.game_constraints
   set constraints = '{
     "fields": {
       "name":            { "required": true, "maxLength": 40 },
       "stats.unitName":  { "maxLength": 40 },
       "stats.speed":     { "min": 0, "max": 20 },
       "stats.evade":     { "min": 0, "max": 9 },
       "stats.armour":    { "min": 0, "max": 9 },
       "stats.hitPoints": { "min": 0, "max": 99 },
       "stats.size":      { "min": 0, "max": 9 },
       "stats.pointsCost":{ "min": 0, "max": 9999 },
       "stats.tags":      { "maxLength": 200 }
     },
     "limits": { "maxKeywords": 20 }
   }'::jsonb
 where game_id = (select id from public.games where slug = 'starcraft')
   and entity_type = 'card'
   and addon_type_id is null;
