-- 20260821020000_battlepack_calendar_signature.sql
--
-- What somebody is holding in their calendar stops being three scalars.
--
-- `battlepack_calendar_adds` records the date a reader saved, as
-- (starts_on, ends_on, starts_at). That describes a one-day event and nothing
-- else: once a pack can be two days, a person holds a LIST of days, and three
-- columns cannot say which of them moved.
--
-- So the snapshot becomes the schedule itself — an ordered array, one entry per
-- segment. Comparison is still plain equality; the difference is that the value
-- can also be READ, which is what lets the email say "Day 2 has moved from
-- Sunday 20 September to Sunday 27 September" rather than just that something
-- did.
--
-- jsonb rather than an opaque hash for exactly that reason. A hash answers "has
-- this changed"; the notification has to answer "changed FROM what", and it has
-- only the stored snapshot to answer with.
--
-- ── Two things it deliberately leaves out ────────────────────────────────────
--
-- `ends_at` — a day's end time. Settled with Chris: people block out the whole
-- day anyway, and organisers will get other ways to reach attendees. Note this
-- is a behaviour change today, not just a future one: the old signature
-- included the pack's `ends_on`, so changing it used to notify and now does
-- not. Every pack in production has a null `ends_on`, so nothing is affected in
-- practice.
--
-- Everything in `battlepack_schedule_items`. Retiming rounds must never be able
-- to mail two hundred people, which is why the day's own times live on the
-- segment rather than being derived from the timetable.
--
-- ── The Edge Function is live and is NOT redeployed by this ──────────────────
--
-- `send-pack-change-notification` reads `held_starts_on`, `held_ends_on`,
-- `held_starts_at` and a text `signature` from battlepack_stale_calendar_adds,
-- and passes that text back to battlepack_mark_calendar_notified. All four keep
-- exactly their old names, types and meanings here — the held_* columns are
-- served from the first entry of the array, which is exact while every pack has
-- one segment. When the multi-day UI ships, the function starts reading the
-- array and that shim can go.
--
-- Every function is CREATE OR REPLACE rather than DROP + CREATE, which
-- preserves the existing grants — including the anon revoke that
-- 20260820000100 exists to enforce.
--
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- ONE DEFINITION OF "WHEN THIS EVENT IS"
--
-- Ordered by `ordinal`, never by date: a segment may have no date yet, and day
-- two must still follow day one.
--
-- The recurrence rule joins this array when those columns land — changing
-- "every Friday" to "every second Friday" invalidates everybody's series, so it
-- has to count. `schedule_shape` will branch it too: a league notifies only on
-- its own start date, so its signature collapses to one entry.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_schedule_signature(pack uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(jsonb_build_object('on', s.starts_on, 'at', s.starts_at) ORDER BY s.ordinal),
    '[]'::jsonb
  )
  FROM public.battlepack_schedule_segments s
  WHERE s.pack_id = pack;
$$;

COMMENT ON FUNCTION public.battlepack_schedule_signature(uuid) IS
  'When a pack happens, as an ordered array of {on, at} per segment. The single definition of whether two schedules are "the same" for notification purposes. Deliberately excludes each day''s end time and everything in battlepack_schedule_items.';

REVOKE ALL ON FUNCTION public.battlepack_schedule_signature(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.battlepack_schedule_signature(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- THE COLUMNS
-- ------------------------------------------------------------
ALTER TABLE public.battlepack_calendar_adds
    ADD COLUMN IF NOT EXISTS held_schedule     jsonb,
    ADD COLUMN IF NOT EXISTS notified_schedule jsonb;

COMMENT ON COLUMN public.battlepack_calendar_adds.held_schedule IS
  'The schedule as it stood when this person added the event — one entry per segment. What they are holding, not what the pack says now: that difference is the whole point.';
COMMENT ON COLUMN public.battlepack_calendar_adds.notified_schedule IS
  'The schedule as at the last email we sent this person about this pack. Suppression only — never a claim about what is in their calendar, which is what held_schedule is for.';

-- Backfill from the scalars rather than from the pack as it stands now. They
-- are the same today, but only one of them is a record of what this person
-- actually saved, and rebuilding from the live pack would quietly turn a stale
-- holding into a current one.
UPDATE public.battlepack_calendar_adds
   SET held_schedule = jsonb_build_array(
         jsonb_build_object('on', starts_on, 'at', starts_at)
       )
 WHERE held_schedule IS NULL;

-- notified_signature is text and holds the OLD three-scalar format, which does
-- not survive translation — a row carrying one has been told about a shape this
-- build no longer speaks. Left NULL, which reads as "never written to" and can
-- at worst cost one duplicate email. No row in production carries one.
ALTER TABLE public.battlepack_calendar_adds
    DROP COLUMN IF EXISTS starts_on,
    DROP COLUMN IF EXISTS ends_on,
    DROP COLUMN IF EXISTS starts_at,
    DROP COLUMN IF EXISTS notified_signature;

-- ------------------------------------------------------------
-- WRITING ONE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_remember_calendar_add(lookup text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target public.battlepacks%ROWTYPE;
BEGIN
    -- Signed out is the ordinary case on a public page, not an error.
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT p.* INTO target
    FROM public.battlepack_slugs s
    JOIN public.battlepacks p ON p.id = s.pack_id
    WHERE s.slug = lower(trim(lookup))
      AND p.status = 'published';

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    INSERT INTO public.battlepack_calendar_adds (user_id, pack_id, held_schedule)
    VALUES (auth.uid(), target.id, public.battlepack_schedule_signature(target.id))
    -- Re-adding refreshes the snapshot: they have just saved the CURRENT
    -- schedule, so they no longer need telling about the change that made them
    -- re-add. notified_schedule is cleared for the same reason — suppression
    -- against an older shape is meaningless once they hold this one.
    ON CONFLICT (user_id, pack_id) DO UPDATE
        SET held_schedule     = EXCLUDED.held_schedule,
            notified_schedule = NULL,
            added_at          = now();

    RETURN true;
END;
$$;

-- ------------------------------------------------------------
-- WHO NEEDS TELLING THAT IT MOVED
--
-- RETURN SHAPE UNCHANGED, and that is a hard requirement rather than a
-- courtesy: send-pack-change-notification is deployed and reads these exact
-- columns. held_* come from the first entry, which is exact while a pack has
-- one segment and is the compatibility shim the header describes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_stale_calendar_adds(pack uuid)
RETURNS TABLE (
  user_id         uuid,
  held_starts_on  date,
  held_ends_on    date,
  held_starts_at  time,
  signature       text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id,
         (a.held_schedule -> 0 ->> 'on')::date,
         -- Never in the signature; kept in the shape so the deployed function's
         -- whenLine() keeps the argument it expects.
         NULL::date,
         (a.held_schedule -> 0 ->> 'at')::time,
         public.battlepack_schedule_signature(a.pack_id)::text
  FROM public.battlepack_calendar_adds a
  JOIN public.battlepacks p ON p.id = a.pack_id
  WHERE a.pack_id = pack
    AND p.status = 'published'
    AND a.held_schedule IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id)
    AND a.notified_schedule IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id);
$$;

CREATE OR REPLACE FUNCTION public.battlepack_pending_notify_count(pack uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.can_edit_battlepack(pack) THEN (
      SELECT count(*)::integer
      FROM public.battlepack_calendar_adds a
      WHERE a.pack_id = pack
        AND a.held_schedule     IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id)
        AND a.notified_schedule IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id)
    )
    ELSE 0
  END;
$$;

-- ------------------------------------------------------------
-- MARK AS TOLD
--
-- Still takes TEXT, because the deployed Edge Function hands back the string it
-- was given. Cast here rather than changing a signature that something live is
-- calling.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_mark_calendar_notified(
  pack uuid, who uuid[], sig text
)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH marked AS (
    UPDATE public.battlepack_calendar_adds
       SET notified_schedule = sig::jsonb,
           notified_at       = now()
     WHERE pack_id = pack
       AND user_id = ANY(who)
    RETURNING 1
  )
  SELECT count(*)::integer FROM marked;
$$;

-- ------------------------------------------------------------
-- THE OLD DEFINITION GOES
--
-- Last, so nothing still references it while it is being removed. Leaving it
-- would be a second answer to "are these the same date", and the whole reason
-- the signature is one function is that two of them drift.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.battlepack_date_signature(date, date, time);

-- ------------------------------------------------------------
-- NO TRIGGER ON SEGMENTS YET, ON PURPOSE
--
-- The settled design fires the notification from battlepacks AND from the
-- segments table. It cannot do both while 20260821010000's mirror trigger is
-- in place: a pack date edit updates the pack (trigger one) and is mirrored
-- onto its segment (trigger two), so every date change would send two emails.
--
-- The segments trigger belongs in the same migration that drops the mirror and
-- flips the cache direction. Until then the pack-level trigger is the only one,
-- and the mirror guarantees the segment it reads is current.
-- ------------------------------------------------------------
