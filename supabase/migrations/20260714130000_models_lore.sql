-- ============================================================
-- Re-add lore fields to models (BattleBox model detail modal)
--
-- lore_name and lore_description were dropped in the original collection
-- import (20260710120000) because every row in the old export was empty. The
-- model detail modal's Lore tab needs them back — now editable per model.
-- ============================================================

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS lore_name        text,
  ADD COLUMN IF NOT EXISTS lore_description text;
