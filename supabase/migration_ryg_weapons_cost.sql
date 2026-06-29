-- migration_ryg_weapons_cost.sql
--
-- Replaces the 'range' stat field with 'cost' (gold pieces) on RYG weapons.
-- Existing weapon rows keep their stats JSON untouched; the old 'range' key
-- becomes inert and new weapons will write 'cost' instead.

update public.addon_types
set stat_schema = '[
  {"key": "damage", "label": "Damage", "type": "text"},
  {"key": "cost",   "label": "Cost (GP)", "type": "number"}
]'::jsonb
where slug = 'weapons'
  and game_id = (select id from public.games where slug = 'ryg');
