-- migration_ryg_weapons_range.sql
--
-- Adds a 'range' (inches) stat field to RYG weapons.
-- A value of 0 means melee and is omitted from the card display.

update public.addon_types
set stat_schema = '[
  {"key": "damage", "label": "Damage",        "type": "text"},
  {"key": "range",  "label": "Range (inches)", "type": "number"},
  {"key": "cost",   "label": "Cost (GP)",      "type": "number"}
]'::jsonb
where slug = 'weapons'
  and game_id = (select id from public.games where slug = 'ryg');
