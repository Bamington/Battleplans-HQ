-- ============================================================
-- BattleCards — custom action labels for TokenMenu entries
-- Paste this into the Supabase SQL editor and run it.
--
-- Adds two nullable text columns on `token_definitions` that let a row
-- override the labels TokenMenu builds for its add / reduce actions.
--
--   • label_on  — replaces the default "increment" label entirely.
--                 Default templates: "Add X", "Mark as X", "Add Xs".
--                 Example: set to "Increase Health" for the KT Wound
--                 token to repurpose the menu copy.
--
--   • label_off — replaces the default "decrement" label entirely.
--                 Default templates: "Reduce X", "Remove X", "Reduce Xs".
--
-- Null in either column = use the existing template (so this migration
-- is a no-op for behavior; it just unlocks per-row customisation).
--
-- Each override replaces the WHOLE label including the verb. The
-- token's `name` is not appended; the renderer uses the string as-is.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.token_definitions
  add column if not exists label_on  text,
  add column if not exists label_off text;
