-- 20260727010000_battlepack_event_basics.sql
--
-- Two columns the Event Basics panel and the home screen need, which the
-- original schema did not have.
--
--   ends_on     — the home screen lists "Starts 14/07/2026 / Ends 26/09/2026".
--                 A league runs for months, so an end date is not derivable
--                 from the start; it is its own fact.
--   description — the "Brief Description" field in Event Basics. Event Basics
--                 is a `core`-storage category, so its fields are real columns
--                 rather than jsonb.
--
-- Both nullable: a pack is created with only a name and a game, and everything
-- else is filled in afterwards. Neither is required to publish — completeness
-- is the registry's business, not the database's.
--
-- Purely additive. Idempotent.

ALTER TABLE public.battlepacks
    ADD COLUMN IF NOT EXISTS ends_on     date,
    ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.battlepacks.ends_on IS
  'Last day of the event. Null for a single-day event, or before the organiser has said.';
COMMENT ON COLUMN public.battlepacks.description IS
  'Brief Description from Event Basics — flavour text, not rules or format detail.';
