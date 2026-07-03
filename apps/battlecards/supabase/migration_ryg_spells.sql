-- migration_ryg_spells.sql
--
-- Adds a 'spells' addon type to the RYG game.
-- Keywords for spells are stored via addon_keywords (same as weapons),
-- filtered in the UI by keywords.category = 'spell'.

insert into public.addon_types (game_id, slug, name, stat_schema)
values (
  (select id from public.games where slug = 'ryg'),
  'spells',
  'Spells',
  '[
    {"key": "type",         "label": "Type",           "type": "text"},
    {"key": "range",        "label": "Range (inches)",  "type": "number"},
    {"key": "radius",       "label": "Radius (inches)", "type": "number"},
    {"key": "target",       "label": "Target",          "type": "text"},
    {"key": "fateModifier", "label": "Fate Modifier",   "type": "text"},
    {"key": "effect",       "label": "Effect",          "type": "text"}
  ]'::jsonb
);
