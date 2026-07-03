-- ============================================================
-- BattleCards — add pointsCost to Halo Flashpoint stat schemas
-- Appends a pointsCost field to the game and weapon addon_type stat_schema arrays.
-- ============================================================

-- Add pointsCost to the Halo: Flashpoint game stat_schema
update public.games
set stat_schema = stat_schema || '[{"key": "pointsCost", "label": "Points Cost", "type": "number"}]'::jsonb
where slug = 'halo-flashpoint';

-- Add pointsCost to the Halo: Flashpoint weapons addon_type stat_schema
update public.addon_types
set stat_schema = stat_schema || '[{"key": "pointsCost", "label": "Points Cost", "type": "text"}]'::jsonb
where slug = 'weapons'
  and game_id = (select id from public.games where slug = 'halo-flashpoint');
