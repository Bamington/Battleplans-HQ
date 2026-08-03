-- 20260728010000_battlepack_durations.sql
--
-- The day is now described by how long each part lasts, not by when each part
-- happens.
--
-- Asking an organiser to type a start and a finish for every round is asking
-- them to do arithmetic the app can do, and to redo it every time anything is
-- reordered or removed. A round is "two hours"; where it lands follows from the
-- day's start time and everything before it.
--
-- So `duration_minutes` on each item, `starts_at` on the pack for the anchor,
-- and the per-item times are derived rather than stored. Storing them as well
-- would be a second source of truth that goes stale on the first drag.
--
-- Also adds `format` — "2000 Points, Matched Play" — which the Key Info panel
-- shows and which used to be typed into a category of its own.
--
-- EXISTING DATA IS CONVERTED, not dropped: each item's duration comes from the
-- gap between its own start and end, and each pack's start time comes from its
-- first item. Nothing has to be retyped.

-- ── The pack's anchor ────────────────────────────────────────────────────────
ALTER TABLE public.battlepacks
    ADD COLUMN IF NOT EXISTS starts_at time,
    ADD COLUMN IF NOT EXISTS format    text;

COMMENT ON COLUMN public.battlepacks.starts_at IS
  'What time the day begins. Every schedule item''s clock time is derived from this plus the durations before it.';
COMMENT ON COLUMN public.battlepacks.format IS
  'Free text shown in Key Info, e.g. "2000 Points, Matched Play".';

-- ── Durations ────────────────────────────────────────────────────────────────
ALTER TABLE public.battlepack_schedule_items
    ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- Convert what is already there. `ends_at < starts_at` means the item ran past
-- midnight, so add a day rather than producing a negative length.
UPDATE public.battlepack_schedule_items
   SET duration_minutes = GREATEST(
         0,
         ROUND(EXTRACT(EPOCH FROM (
           CASE WHEN ends_at < starts_at THEN ends_at + interval '1 day' ELSE ends_at END
           - starts_at
         )) / 60)::integer
       )
 WHERE duration_minutes IS NULL
   AND starts_at IS NOT NULL
   AND ends_at IS NOT NULL;

-- Anything with no times to convert gets a sensible default rather than a null:
-- a round is two hours and a break is ten minutes, which is what the create
-- flow offers.
UPDATE public.battlepack_schedule_items
   SET duration_minutes = CASE WHEN kind = 'round' THEN 120 ELSE 10 END
 WHERE duration_minutes IS NULL;

ALTER TABLE public.battlepack_schedule_items
    ALTER COLUMN duration_minutes SET NOT NULL,
    ALTER COLUMN duration_minutes SET DEFAULT 60;

ALTER TABLE public.battlepack_schedule_items
    ADD CONSTRAINT battlepack_schedule_items_duration_check
    CHECK (duration_minutes >= 0);

COMMENT ON COLUMN public.battlepack_schedule_items.duration_minutes IS
  'How long this part of the day lasts. Its clock time is derived from the pack''s starts_at plus every duration before it.';

-- Each pack's day starts when its first item did.
UPDATE public.battlepacks p
   SET starts_at = first_item.starts_at
  FROM (
        SELECT DISTINCT ON (pack_id) pack_id, starts_at
          FROM public.battlepack_schedule_items
         WHERE starts_at IS NOT NULL
         ORDER BY pack_id, ordinal
       ) AS first_item
 WHERE first_item.pack_id = p.id
   AND p.starts_at IS NULL;

-- ── The old columns go ───────────────────────────────────────────────────────
--
-- Dropped rather than left in place. Two ways to know when a round starts is
-- exactly the trap this change exists to close, and BattlePack is unlaunched
-- and admin-only, so nothing outside the editor has ever read them.
ALTER TABLE public.battlepack_schedule_items
    DROP COLUMN IF EXISTS starts_at,
    DROP COLUMN IF EXISTS ends_at;
