-- ============================================================
-- BattleCards — Kill Team weapons: hit + damage refactor
-- Paste this into the Supabase SQL editor and run it.
--
-- Schema change for the `weapons` addon_type (game = kill-team):
--   • hit:        text   →  number    (UI appends `+` when displaying)
--   • damage:     text   →  REMOVED
--   • baseDamage:        number       (NEW)
--   • critDamage:        number       (NEW)
--
-- Existing weapon addons are re-written in place:
--   • `hit` strings like "3+" are parsed to int (digits only)
--   • `damage` strings like "3/4" are split on '/' into baseDamage + critDamage
--
-- Idempotent — once a row has had its `damage` key removed it's skipped on
-- subsequent runs.
-- ============================================================

-- 1) Replace the stat_schema on the addon_type definition
update public.addon_types
set stat_schema = '[
    {"key": "meleeOrRanged", "label": "Melee or Ranged", "type": "text"},
    {"key": "attack",        "label": "Attack",          "type": "number"},
    {"key": "hit",           "label": "Hit",             "type": "number"},
    {"key": "baseDamage",    "label": "Base Damage",     "type": "number"},
    {"key": "critDamage",    "label": "Crit Damage",     "type": "number"}
  ]'::jsonb
where slug = 'weapons'
  and game_id = (select id from public.games where slug = 'kill-team');

-- 2) Translate existing weapon addon data
update public.addons a
set stats = (
  (a.stats - 'hit' - 'damage')
  || jsonb_build_object(
       'hit',
         coalesce(
           nullif(regexp_replace(coalesce(a.stats ->> 'hit', ''), '[^0-9]', '', 'g'), ''),
           '0'
         )::int,
       'baseDamage',
         coalesce(
           nullif(regexp_replace(split_part(coalesce(a.stats ->> 'damage', ''), '/', 1), '[^0-9]', '', 'g'), ''),
           '0'
         )::int,
       'critDamage',
         coalesce(
           nullif(regexp_replace(split_part(coalesce(a.stats ->> 'damage', ''), '/', 2), '[^0-9]', '', 'g'), ''),
           '0'
         )::int
     )
)
where a.addon_type_id = (
  select at.id from public.addon_types at
  join public.games g on g.id = at.game_id
  where g.slug = 'kill-team' and at.slug = 'weapons'
)
  and a.stats ? 'damage';
