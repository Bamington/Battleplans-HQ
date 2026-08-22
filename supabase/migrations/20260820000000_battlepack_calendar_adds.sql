-- 20260820000000_battlepack_calendar_adds.sql
--
-- Remember who put an event in their own calendar.
--
-- The public pack page now offers "Add to Calendar". Once an attendee has done
-- that, the event lives in a second place we do not control — and the two go
-- out of sync the moment the organiser moves the date or takes the pack down.
-- A calendar entry that still says 10am on the 6th is worse than no entry at
-- all, because the attendee has stopped checking the page.
--
-- So this records the add. It is deliberately SILENT: nothing in the UI says a
-- row was written, nothing reads it back to the attendee, and the organiser is
-- not shown a list. The single reason it exists is to have somebody to tell
-- when the event changes.
--
-- THE SNAPSHOT IS THE POINT. Storing only (who, which pack) would say that
-- somebody has this event saved, but not WHAT they have saved. Keeping the
-- date and time as they were at the moment of the add makes "the pack's date no
-- longer matches what this person put in their calendar" a plain comparison
-- rather than a guess, and it survives several date changes in a row: whoever
-- has already been told carries the new date, whoever has not still carries the
-- old one.
--
-- Purely additive — one new table, one new function, no existing object
-- altered. Safe to apply to the shared database ahead of any deploy.
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- THE TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepack_calendar_adds (
    user_id  uuid NOT NULL REFERENCES auth.users (id)          ON DELETE CASCADE,
    pack_id  uuid NOT NULL REFERENCES public.battlepacks (id)  ON DELETE CASCADE,

    -- What the pack said when they added it. Not what it says now — that is
    -- the whole comparison. NULL is legitimate: an organiser can publish a
    -- pack before settling on a date, and somebody can save it anyway.
    starts_on date,
    ends_on   date,
    starts_at time,

    -- Overwritten when the same person adds the same pack again, which is how
    -- somebody re-saves an event after we have told them it moved.
    added_at  timestamptz NOT NULL DEFAULT now(),

    -- One row per person per pack. Adding twice is not two facts.
    PRIMARY KEY (user_id, pack_id)
);

COMMENT ON TABLE public.battlepack_calendar_adds IS
    'Who has added a published pack to their own calendar, with the date/time they saved. Written only by battlepack_remember_calendar_add(); read by the job that tells people when an event moves or is cancelled.';

COMMENT ON COLUMN public.battlepack_calendar_adds.starts_on IS
    'The pack''s start date AT THE MOMENT OF THE ADD, not now. Differing from battlepacks.starts_on is exactly what identifies somebody who needs telling.';

-- "Everyone who saved this pack" is the query the notification side runs, and
-- the primary key leads with user_id, so it cannot serve it.
CREATE INDEX IF NOT EXISTS battlepack_calendar_adds_pack_idx
    ON public.battlepack_calendar_adds (pack_id);

-- ------------------------------------------------------------
-- WHO MAY TOUCH IT
--
-- Reading and deleting are yours alone: this is a record of something you did,
-- and nobody else — organiser, venue admin, or another attendee — has any
-- business enumerating it. Platform admins are deliberately NOT given a
-- policy either; the notification job runs as the service role, which is not
-- subject to RLS at all.
--
-- THERE IS NO INSERT POLICY, AND THAT IS DELIBERATE. Writing goes through
-- battlepack_remember_calendar_add() below, which is SECURITY DEFINER and
-- therefore not subject to these policies. That leaves exactly one way in, and
-- it is a way that resolves the pack itself — so a client cannot claim to have
-- saved a draft, somebody else's pack, or a pack id it guessed.
-- ------------------------------------------------------------
ALTER TABLE public.battlepack_calendar_adds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own calendar adds are readable" ON public.battlepack_calendar_adds;
CREATE POLICY "Own calendar adds are readable"
    ON public.battlepack_calendar_adds FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own calendar adds are removable" ON public.battlepack_calendar_adds;
CREATE POLICY "Own calendar adds are removable"
    ON public.battlepack_calendar_adds FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Same reasoning as 20260727000100: anon gets Supabase's default seven
-- privileges on every new table in public, they are inert under RLS, and they
-- come off anyway. The anonymous half of the public page is the majority of
-- its traffic, and the safe shape of a future mistake is one made on a table
-- anon cannot reach.
REVOKE ALL ON public.battlepack_calendar_adds FROM anon;

-- ------------------------------------------------------------
-- THE ONLY WAY TO WRITE ONE
--
-- Takes the SLUG, not a pack id, for the same reason battlepack_by_slug does:
-- the public page knows a slug, the function resolves it, and there is no
-- filter the caller can influence beyond the address they are already looking
-- at. A draft or an unpublished pack resolves to nothing, so the "add to
-- calendar" of a pack that is not public cannot be recorded even by a caller
-- crafting the RPC by hand.
--
-- Returns a boolean rather than raising. The caller is a fire-and-forget click
-- handler on a button whose actual job — handing the user an event — has
-- already succeeded by the time this runs. Failing loudly would turn a
-- bookkeeping miss into a broken feature.
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
    -- Signed out is the ordinary case on a public page, not an error. There is
    -- nobody to tell later, so there is nothing to write.
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT p.* INTO target
    FROM public.battlepack_slugs s
    JOIN public.battlepacks p ON p.id = s.pack_id
    -- Lowercased for the same reason as battlepack_by_slug: the key is already
    -- lowercase, so this is what makes /TEST-Event and /test-event the same
    -- pack rather than one that records and one that does not.
    WHERE s.slug = lower(trim(lookup))
      AND p.status = 'published';

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    INSERT INTO public.battlepack_calendar_adds (user_id, pack_id, starts_on, ends_on, starts_at)
    VALUES (auth.uid(), target.id, target.starts_on, target.ends_on, target.starts_at)
    -- Re-adding refreshes the snapshot: they have just saved the CURRENT date,
    -- so they no longer need telling about the change that made them re-add.
    ON CONFLICT (user_id, pack_id) DO UPDATE
        SET starts_on = EXCLUDED.starts_on,
            ends_on   = EXCLUDED.ends_on,
            starts_at = EXCLUDED.starts_at,
            added_at  = now();

    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.battlepack_remember_calendar_add(text) IS
    'Record that the calling user added a published pack to their calendar, by slug. Snapshots the pack''s date/time so a later change can be told apart. Returns false (never raises) when signed out or when the slug is not a published pack.';

-- Authenticated only. anon is not granted execute because there is nothing it
-- could achieve — the function's first act is to check auth.uid() — and a
-- public endpoint that writes should not be reachable without a session even
-- when it is a no-op.
REVOKE ALL ON FUNCTION public.battlepack_remember_calendar_add(text) FROM public;
GRANT EXECUTE ON FUNCTION public.battlepack_remember_calendar_add(text) TO authenticated;
