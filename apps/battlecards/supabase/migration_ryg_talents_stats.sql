-- migration_ryg_talents_stats.sql
--
-- Adds prerequisites and repeatable fields to the RYG talents addon type.
-- Run this if you already ran migration_ryg_talents.sql.

update public.addon_types
set stat_schema = '[
  {"key": "prerequisites", "label": "Prerequisites", "type": "text"},
  {"key": "repeatable",    "label": "Repeatable",    "type": "boolean"}
]'::jsonb
where slug = 'talents'
  and game_id = (select id from public.games where slug = 'ryg');
