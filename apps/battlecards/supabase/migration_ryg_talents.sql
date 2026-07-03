-- migration_ryg_talents.sql
--
-- Adds a 'talents' addon type to Repent Ye Foolish Gods.
-- Talents are a separate reusable entity from keywords — each has a name
-- and description. Warriors attach talents via card_addons (not card_keywords).
-- Warrior types can list predefined talent addon IDs in stats.talentIds[].

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Talents', 'talents', '[
  {"key": "prerequisites", "label": "Prerequisites", "type": "text"},
  {"key": "repeatable",    "label": "Repeatable",    "type": "boolean"}
]'::jsonb
from public.games
where slug = 'ryg';
