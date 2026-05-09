-- ============================================================
-- BattleCards — Kill Team: add baseSize to operative stat_schema
-- Paste this into the Supabase SQL editor and run it.
--
-- Appends a `baseSize` (number) field to the kill-team game's stat_schema.
-- Existing operative cards' `stats` JSONB are unaffected — when no value
-- is present, the UI treats it as 0.
--
-- Idempotent — re-running is safe; the JSONB `||` operator overwrites the
-- baseSize entry if it already exists at the end of the array, but the
-- WHERE-clause filter prevents adding it twice (it only runs when the
-- stat_schema doesn't already contain a baseSize key).
-- ============================================================

update public.games
set stat_schema = stat_schema || '[{"key": "baseSize", "label": "Base Size", "type": "number"}]'::jsonb
where slug = 'kill-team'
  and not exists (
    select 1
    from jsonb_array_elements(stat_schema) as elem
    where elem ->> 'key' = 'baseSize'
  );
