-- migration_ryg_items_cost.sql
--
-- Adds a 'cost' (gold pieces) stat field to RYG items.

update public.addon_types
set stat_schema = '[
  {"key": "cost", "label": "Cost (GP)", "type": "number"}
]'::jsonb
where slug = 'items'
  and game_id = (select id from public.games where slug = 'ryg');
