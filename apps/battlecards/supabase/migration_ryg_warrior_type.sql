-- migration_ryg_warrior_type.sql
--
-- Adds the 'warrior-type' addon type to Repent Ye Foolish Gods.
--
-- Each warrior type is an addon with:
--   name        → the type name (e.g. "Berserker")
--   stats       → { offense, defense, life, tactics, fate, abilityName }
--   description → the special ability description text
--
-- The builder seeds the card's stat counters and special ability from the
-- selected type, but the user may edit them freely afterwards.

insert into public.addon_types (game_id, name, slug, stat_schema)
select g.id, 'Warrior Type', 'warrior-type',
  '[
    {"key": "offense",     "label": "Offense",      "type": "number"},
    {"key": "defense",     "label": "Defense",      "type": "number"},
    {"key": "life",        "label": "Life",         "type": "number"},
    {"key": "tactics",     "label": "Tactics",      "type": "number"},
    {"key": "fate",        "label": "Fate",         "type": "number"},
    {"key": "abilityName", "label": "Ability Name", "type": "text"}
  ]'::jsonb
from public.games g
where g.slug = 'ryg';

-- Max one warrior type per card
insert into public.game_constraints (game_id, entity_type, addon_type_id, constraints)
select g.id, 'addon', at.id, '{
  "fields": {
    "name":              { "required": true, "maxLength": 60 },
    "stats.abilityName": { "maxLength": 60 },
    "description":       { "maxLength": 2000 },
    "stats.offense":     { "min": 0, "max": 99 },
    "stats.defense":     { "min": 0, "max": 99 },
    "stats.life":        { "min": 0, "max": 99 },
    "stats.tactics":     { "min": 0, "max": 99 },
    "stats.fate":        { "min": 0, "max": 99 }
  },
  "limits": {
    "maxPerCard": 1
  }
}'::jsonb
from public.games g
join public.addon_types at on at.game_id = g.id and at.slug = 'warrior-type'
where g.slug = 'ryg';
