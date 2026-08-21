-- 20260821010000_battlepack_schedule_segments.sql
--
-- The level a schedule hangs off, so an event can be more than one day long.
--
-- Today a pack has one date, one start time, and a flat list of rounds. That
-- models a one-day tournament and nothing else: a two-day event has two days
-- with two timetables, and a league has periods rather than days. Both are the
-- same shape — a sequence of SEGMENTS, each with its own dates and its own
-- items — so both get one table rather than one each.
--
-- EVERY PACK HAS AT LEAST ONE SEGMENT, including the one-day packs that exist
-- today. That is the point of the backfill: "one-day" stops being a type and
-- becomes a COUNT, so growing a one-dayer into a two-dayer is adding a row
-- rather than converting anything. Nothing downstream needs a special case for
-- "a pack with no segments", because there is no such pack.
--
-- ── starts_on is NULLABLE, and that is deliberate ────────────────────────────
--
-- The plan said NOT NULL. Production disagrees: a pack is publishable before
-- its date is agreed — the calendar code already says so — and one such pack
-- exists. Forcing NOT NULL would mean either failing the backfill or leaving
-- that pack segment-less, and the invariant above is worth more than the
-- constraint. Ordering is by `ordinal`, never by date, so a dateless segment
-- still has a definite place.
--
-- ── Written to be safe in front of the app that is deployed ──────────────────
--
-- One Supabase project sits behind production and every preview, so this has to
-- work with the BattlePack that is live right now — which has never heard of a
-- segment. Three triggers bridge that:
--
--   * a new pack gets its first segment automatically, so a pack created by
--     today's app is not born broken;
--   * a schedule item inserted without a segment is attached to the pack's
--     first one, so today's app keeps writing valid rows;
--   * an edit to the pack's date is mirrored onto its sole segment, so the two
--     cannot drift apart between now and the deploy.
--
-- THE THIRD ONE POINTS THE WRONG WAY ON PURPOSE AND IS TEMPORARY. The settled
-- design has the pack's date columns become a cache OF the segments; until the
-- app can write segments, the pack columns are still the only thing being
-- edited, so the mirror runs pack → segment. It is dropped in the migration
-- that flips the direction, and it deliberately does nothing once a pack has
-- more than one segment — at that point the envelope is derived, not authored.
--
-- Purely additive: one table, one column, three triggers. Nothing existing
-- changes meaning. Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- THE TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepack_schedule_segments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id    uuid NOT NULL REFERENCES public.battlepacks (id) ON DELETE CASCADE,

    -- Position in the event, and the ONLY ordering. A segment may have no date
    -- yet, so date order cannot be relied on to put day 2 after day 1.
    ordinal    integer NOT NULL,

    -- When this part of the event happens. `ends_on` is for a league period
    -- spanning days ("Week 3"); a single day leaves it null.
    starts_on  date,
    ends_on    date,

    -- The DAY's own start and end — not the timetable's. What an attendee puts
    -- in a calendar is this, and the rounds inside are an internal matter, so
    -- adding a round must not silently move somebody's diary entry.
    starts_at  time,
    ends_at    time,

    -- "Day 1", "Week 3 — Break Week". Null falls back to a derived label.
    label      text,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- DEFERRABLE for the same reason the items constraint is: a drag-reorder
    -- renumbers rows inside one transaction without shuffling through spare
    -- ordinals first.
    CONSTRAINT battlepack_schedule_segments_pack_ordinal_key
        UNIQUE (pack_id, ordinal) DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.battlepack_schedule_segments IS
  'One part of an event with its own dates: a day of a multi-day tournament, or a period of a league. Every pack has at least one, so "one-day" is a count of these rather than a type.';
COMMENT ON COLUMN public.battlepack_schedule_segments.starts_at IS
  'When this day begins, as the organiser states it — not as the timetable implies. The calendar entry is built from this and ends_at, so changing a round''s length cannot move it.';

CREATE INDEX IF NOT EXISTS battlepack_schedule_segments_pack_id_idx
    ON public.battlepack_schedule_segments USING btree (pack_id, ordinal);

-- An end with no beginning is not a range. Both directions of both pairs.
ALTER TABLE public.battlepack_schedule_segments
    DROP CONSTRAINT IF EXISTS battlepack_schedule_segments_dates_check;
ALTER TABLE public.battlepack_schedule_segments
    ADD CONSTRAINT battlepack_schedule_segments_dates_check
    CHECK (ends_on IS NULL OR (starts_on IS NOT NULL AND ends_on >= starts_on));

-- Deliberately NOT "both or neither": a pack whose timetable is empty has no
-- end time to derive, and the backfill below would have to invent one. The UI
-- will require both when it ships, and this can tighten with it.
ALTER TABLE public.battlepack_schedule_segments
    DROP CONSTRAINT IF EXISTS battlepack_schedule_segments_times_check;
ALTER TABLE public.battlepack_schedule_segments
    ADD CONSTRAINT battlepack_schedule_segments_times_check
    CHECK (ends_at IS NULL OR starts_at IS NOT NULL);

-- ------------------------------------------------------------
-- WHO MAY TOUCH IT
-- Exactly what battlepack_schedule_items has: a segment is part of the pack,
-- and anyone who can edit the pack can edit its shape.
-- ------------------------------------------------------------
ALTER TABLE public.battlepack_schedule_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack editors manage its segments" ON public.battlepack_schedule_segments;
CREATE POLICY "Pack editors manage its segments"
    ON public.battlepack_schedule_segments
    TO authenticated
    USING (public.can_edit_battlepack(pack_id))
    WITH CHECK (public.can_edit_battlepack(pack_id));

-- Same reasoning as 20260727000100: anon reads published packs through
-- battlepack_by_slug and never through a table.
REVOKE ALL ON public.battlepack_schedule_segments FROM anon;

-- ------------------------------------------------------------
-- ITEMS BELONG TO A SEGMENT
-- ------------------------------------------------------------
ALTER TABLE public.battlepack_schedule_items
    ADD COLUMN IF NOT EXISTS segment_id uuid
        REFERENCES public.battlepack_schedule_segments (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.battlepack_schedule_items.segment_id IS
  'The day or period this item sits in. Filled automatically for clients that do not know about segments yet — see battlepack_item_default_segment().';

-- ------------------------------------------------------------
-- BACKFILL — one segment per existing pack
--
-- `ends_at` is derived from the timetable ONCE, here, so today's calendar
-- entries keep the end time they already have. From now on it is the
-- organiser's value and the timetable stops driving it, which is the whole
-- reason the column exists.
-- ------------------------------------------------------------
INSERT INTO public.battlepack_schedule_segments
    (pack_id, ordinal, starts_on, ends_on, starts_at, ends_at)
SELECT
    p.id,
    1,
    p.starts_on,
    p.ends_on,
    p.starts_at,
    CASE
        WHEN p.starts_at IS NULL THEN NULL
        WHEN t.total IS NULL OR t.total = 0 THEN NULL
        -- make_interval rather than `total * interval '1 minute'`: SUM() returns
        -- bigint and there is no bigint * interval operator.
        -- time + interval wraps past midnight, which is what an event running
        -- to 00:30 should record.
        ELSE p.starts_at + make_interval(mins => t.total::int)
    END
FROM public.battlepacks p
LEFT JOIN (
    SELECT pack_id, SUM(duration_minutes) AS total
    FROM public.battlepack_schedule_items
    GROUP BY pack_id
) t ON t.pack_id = p.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.battlepack_schedule_segments s WHERE s.pack_id = p.id
);

UPDATE public.battlepack_schedule_items i
   SET segment_id = s.id
  FROM public.battlepack_schedule_segments s
 WHERE s.pack_id = i.pack_id
   AND s.ordinal = 1
   AND i.segment_id IS NULL;

-- ------------------------------------------------------------
-- THE BRIDGES
-- ------------------------------------------------------------

-- A pack created by any client gets its first segment, so the invariant holds
-- no matter which build did the insert. Only ever the FIRST — a client that
-- knows about segments adds the rest itself.
CREATE OR REPLACE FUNCTION public.battlepack_create_first_segment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.battlepack_schedule_segments
        (pack_id, ordinal, starts_on, ends_on, starts_at)
    VALUES (new.id, 1, new.starts_on, new.ends_on, new.starts_at);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_create_first_segment ON public.battlepacks;
CREATE TRIGGER battlepacks_create_first_segment
    AFTER INSERT ON public.battlepacks
    FOR EACH ROW EXECUTE FUNCTION public.battlepack_create_first_segment();

-- An item inserted without a segment joins the pack's first one. This is what
-- lets the currently deployed editor keep adding rounds to a pack without
-- knowing segments exist.
CREATE OR REPLACE FUNCTION public.battlepack_item_default_segment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF new.segment_id IS NULL THEN
        SELECT s.id INTO new.segment_id
        FROM public.battlepack_schedule_segments s
        WHERE s.pack_id = new.pack_id
        ORDER BY s.ordinal
        LIMIT 1;
    END IF;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS battlepack_items_default_segment ON public.battlepack_schedule_items;
CREATE TRIGGER battlepack_items_default_segment
    BEFORE INSERT ON public.battlepack_schedule_items
    FOR EACH ROW EXECUTE FUNCTION public.battlepack_item_default_segment();

-- TEMPORARY, AND POINTING THE WRONG WAY ON PURPOSE.
--
-- The settled design makes the pack's date columns a cache of its segments.
-- Until the app can edit a segment, the pack columns are the only thing an
-- organiser can change, so the mirror has to run the other way or the two
-- drift apart between this migration and that deploy.
--
-- It stands down the moment a pack has more than one segment: from then on the
-- envelope is derived and an edit to it is not an authoritative statement about
-- day one. Dropped entirely when the direction flips.
CREATE OR REPLACE FUNCTION public.battlepack_mirror_dates_to_segment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.battlepack_schedule_segments s
       SET starts_on = new.starts_on,
           ends_on   = new.ends_on,
           starts_at = new.starts_at
     WHERE s.pack_id = new.id
       AND (SELECT count(*) FROM public.battlepack_schedule_segments x
            WHERE x.pack_id = new.id) = 1;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_mirror_dates_to_segment ON public.battlepacks;
CREATE TRIGGER battlepacks_mirror_dates_to_segment
    AFTER UPDATE OF starts_on, ends_on, starts_at ON public.battlepacks
    FOR EACH ROW
    WHEN (
         old.starts_on IS DISTINCT FROM new.starts_on
      OR old.ends_on   IS DISTINCT FROM new.ends_on
      OR old.starts_at IS DISTINCT FROM new.starts_at
    )
    EXECUTE FUNCTION public.battlepack_mirror_dates_to_segment();

-- ------------------------------------------------------------
-- ORDINALS BECOME PER-SEGMENT
--
-- Day 1 and Day 2 both start at round 1, which the old (pack_id, ordinal)
-- constraint would reject. Safe to swap now because the trigger above
-- guarantees every item has a segment, and while a pack has exactly one
-- segment the two constraints are the same constraint.
-- ------------------------------------------------------------
ALTER TABLE public.battlepack_schedule_items
    DROP CONSTRAINT IF EXISTS battlepack_schedule_items_pack_ordinal_key;

ALTER TABLE public.battlepack_schedule_items
    DROP CONSTRAINT IF EXISTS battlepack_schedule_items_segment_ordinal_key;
ALTER TABLE public.battlepack_schedule_items
    ADD CONSTRAINT battlepack_schedule_items_segment_ordinal_key
    UNIQUE (segment_id, ordinal) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS battlepack_schedule_items_segment_id_idx
    ON public.battlepack_schedule_items USING btree (segment_id, ordinal);

-- NOT NULL last, so it doubles as an assertion that the backfill covered
-- everything: if a single item were left without a segment this migration
-- fails here rather than leaving a row that no uniqueness applies to — NULLs
-- are distinct in a unique constraint, so a null segment_id would quietly opt
-- out of the ordinal rule above.
--
-- Safe in front of the deployed app because BEFORE ROW triggers run before
-- constraints are checked: an item inserted with no segment has one by the
-- time NOT NULL is evaluated.
ALTER TABLE public.battlepack_schedule_items
    ALTER COLUMN segment_id SET NOT NULL;
