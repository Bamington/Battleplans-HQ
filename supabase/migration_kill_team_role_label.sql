-- ============================================================
-- BattleCards — Kill Team: rename "Role" stat label to "Operative Type"
-- Paste this into the Supabase SQL editor and run it.
--
-- The `role` stat key keeps its name in the data model (existing rows
-- already store values under `stats.role`); only the user-facing
-- `label` on the games.stat_schema entry changes.
--
-- Idempotent — safe to re-run.
-- ============================================================

update public.games
set stat_schema = (
  select jsonb_agg(
    case
      when (elem->>'key') = 'role'
        then jsonb_set(elem, '{label}', '"Operative Type"'::jsonb)
      else elem
    end
  )
  from jsonb_array_elements(stat_schema) elem
)
where slug = 'kill-team';
