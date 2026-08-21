-- 20260821050000_battlepack_envelope_flip.sql
--
-- The pack's dates become a cache of its segments, and the notification moves
-- with them.
--
-- 20260821010000 mirrored pack → segment, because the deployed app could only
-- edit the pack and the two would otherwise drift. That was always temporary
-- and its header said so. This turns it round: the SEGMENTS are now authored
-- and `battlepacks.starts_on / ends_on / starts_at` are derived from them.
--
-- The envelope keeps its meaning exactly, which is the point of keeping it at
-- all: BattlePlan's Upcoming column, Key Info, the table blocks and the social
-- preview all read those three columns and none of them has to learn what a
-- segment is.
--
-- ── Where the email now comes from ───────────────────────────────────────────
--
-- Dates live on segments, so "the date moved" is a SEGMENT event and fires from
-- there. The pack-level trigger keeps only what is genuinely a pack fact:
-- withdrawn, and republished.
--
-- The two must not overlap or one change sends two emails, which is exactly why
-- the segments trigger could not be added while the mirror existed. Note that
-- the envelope sync below writes to `battlepacks` — if that trigger still
-- watched the date columns, every segment edit would fire it a second time
-- through the cache update. It no longer does.
--
-- ── One-day packs keep a NULL ends_on ────────────────────────────────────────
--
-- max(coalesce(ends_on, starts_on)) over a single day returns that day, so a
-- naive cache would set ends_on where it has always been null — and Key Info
-- renders a range whenever it is set, so every one-day event would suddenly
-- read "19/09/2026 – 19/09/2026". It is nulled when it equals the start, which
-- preserves the existing meaning: an end date is a fact about spanning days.
--
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- THE MIRROR GOES
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS battlepacks_mirror_dates_to_segment ON public.battlepacks;
DROP FUNCTION IF EXISTS public.battlepack_mirror_dates_to_segment();

-- ------------------------------------------------------------
-- THE ENVELOPE
--
-- Only writes when something actually differs, so a no-op segment save cannot
-- cascade into a pointless pack update — and, through it, a pointless
-- notification.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_sync_envelope(pack uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_starts_on  date;
    v_ends_on    date;
    v_starts_at  time;
    v_recurrence text;
    v_until      date;
BEGIN
    SELECT min(s.starts_on), max(coalesce(s.ends_on, s.starts_on))
      INTO v_starts_on, v_ends_on
      FROM public.battlepack_schedule_segments s
     WHERE s.pack_id = pack;

    -- The FIRST segment's time, by ordinal rather than by date: ordinal is the
    -- only ordering a dateless segment has.
    SELECT s.starts_at INTO v_starts_at
      FROM public.battlepack_schedule_segments s
     WHERE s.pack_id = pack
     ORDER BY s.ordinal
     LIMIT 1;

    SELECT p.recurrence, p.until_date INTO v_recurrence, v_until
      FROM public.battlepacks p WHERE p.id = pack;

    -- A repeating event runs until its series does, not until the end of its
    -- first occurrence. `until_date` is the bound rather than the true last
    -- occurrence — at most a few days out, and every consumer of ends_on only
    -- asks "is this over yet".
    IF v_recurrence IS DISTINCT FROM 'none' AND v_until IS NOT NULL THEN
        v_ends_on := v_until;
    END IF;

    -- An end date is a fact about spanning days. See the header.
    IF v_ends_on IS NOT DISTINCT FROM v_starts_on THEN
        v_ends_on := NULL;
    END IF;

    UPDATE public.battlepacks p
       SET starts_on = v_starts_on,
           ends_on   = v_ends_on,
           starts_at = v_starts_at
     WHERE p.id = pack
       AND (p.starts_on IS DISTINCT FROM v_starts_on
         OR p.ends_on   IS DISTINCT FROM v_ends_on
         OR p.starts_at IS DISTINCT FROM v_starts_at);
END;
$$;

COMMENT ON FUNCTION public.battlepack_sync_envelope(uuid) IS
  'Recompute battlepacks.starts_on / ends_on / starts_at from the pack''s segments. The envelope is a cache: every existing reader of those three columns keeps working without knowing segments exist.';

CREATE OR REPLACE FUNCTION public.battlepack_segment_sync_envelope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.battlepack_sync_envelope(
        CASE WHEN tg_op = 'DELETE' THEN old.pack_id ELSE new.pack_id END
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS battlepack_segments_sync_envelope ON public.battlepack_schedule_segments;
CREATE TRIGGER battlepack_segments_sync_envelope
    AFTER INSERT OR UPDATE OR DELETE ON public.battlepack_schedule_segments
    FOR EACH ROW EXECUTE FUNCTION public.battlepack_segment_sync_envelope();

-- The recurring case depends on columns that live on the pack, so a change to
-- the rule has to refresh the envelope too. BEFORE UPDATE and assigning to NEW
-- rather than issuing an UPDATE, which would recurse.
CREATE OR REPLACE FUNCTION public.battlepack_recurrence_envelope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_starts_on date;
    v_ends_on   date;
BEGIN
    SELECT min(s.starts_on), max(coalesce(s.ends_on, s.starts_on))
      INTO v_starts_on, v_ends_on
      FROM public.battlepack_schedule_segments s
     WHERE s.pack_id = new.id;

    IF new.recurrence IS DISTINCT FROM 'none' AND new.until_date IS NOT NULL THEN
        v_ends_on := new.until_date;
    END IF;

    IF v_ends_on IS NOT DISTINCT FROM v_starts_on THEN
        v_ends_on := NULL;
    END IF;

    new.ends_on := v_ends_on;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_recurrence_envelope ON public.battlepacks;
CREATE TRIGGER battlepacks_recurrence_envelope
    BEFORE UPDATE OF recurrence, until_date ON public.battlepacks
    FOR EACH ROW
    WHEN (old.recurrence IS DISTINCT FROM new.recurrence
       OR old.until_date IS DISTINCT FROM new.until_date)
    EXECUTE FUNCTION public.battlepack_recurrence_envelope();

-- ------------------------------------------------------------
-- POSTING A CHANGE
--
-- Lifted out of notify_battlepack_change so the segments trigger can send the
-- same message the same way. Two copies of the secret lookup and the URL would
-- be two places to get the endpoint wrong.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.battlepack_post_change(body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
    v_secret text;
    -- Not a secret: the project ref is already public in every client bundle.
    v_url text := 'https://dezjjuumsrpfioyfhyzg.supabase.co/functions/v1/send-pack-change-notification';
BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name IN ('pack_webhook_secret', 'booking_webhook_secret')
    ORDER BY name DESC
    LIMIT 1;

    IF v_secret IS NULL THEN
        RAISE WARNING 'battlepack_post_change: no webhook secret in vault, skipping';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-secret', v_secret),
        body    := body
    );
END;
$$;

-- ------------------------------------------------------------
-- A SEGMENT MOVED
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_battlepack_segment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
    v_pack uuid := CASE WHEN tg_op = 'DELETE' THEN old.pack_id ELSE new.pack_id END;
BEGIN
    -- Only a published pack has an audience, and only an audience is worth a
    -- round trip. Checked in that order because most edits are to drafts.
    IF NOT EXISTS (
        SELECT 1 FROM public.battlepacks p
        WHERE p.id = v_pack AND p.status = 'published'
    ) THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.battlepack_calendar_adds a WHERE a.pack_id = v_pack
    ) THEN
        RETURN NULL;
    END IF;

    PERFORM public.battlepack_post_change(
        jsonb_build_object('event', 'moved', 'pack_id', v_pack)
    );
    RETURN NULL;

EXCEPTION WHEN others THEN
    -- Never let a notification problem take an organiser's edit down with it.
    RAISE WARNING 'notify_battlepack_segment_change failed: %', sqlerrm;
    RETURN NULL;
END;
$$;

-- Dates and times only. A segment's LABEL is not a date, and renaming "Day 1"
-- to "Finals Day" is not news anybody's calendar needs.
DROP TRIGGER IF EXISTS battlepack_segments_notify_change ON public.battlepack_schedule_segments;
CREATE TRIGGER battlepack_segments_notify_change
    AFTER INSERT OR DELETE OR UPDATE OF starts_on, ends_on, starts_at
    ON public.battlepack_schedule_segments
    FOR EACH ROW EXECUTE FUNCTION public.notify_battlepack_segment_change();

-- ------------------------------------------------------------
-- THE PACK-LEVEL TRIGGER LOSES THE DATES
--
-- They are not pack facts any more. Leaving them would mean every segment edit
-- notified twice: once from the segment, and once from the envelope cache
-- update that follows it.
--
-- What stays is what is still genuinely a pack fact — leaving published, and
-- coming back to it. A republish still says 'moved' because the audience query
-- is what decides who is stale, and somebody whose date drifted while the pack
-- was down is exactly that.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_battlepack_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
    v_recipients jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.battlepack_calendar_adds a
        WHERE a.pack_id = CASE WHEN tg_op = 'DELETE' THEN old.id ELSE new.id END
    ) THEN
        RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE NULL END;
    END IF;

    IF tg_op = 'DELETE' THEN
        -- Gathered here because this is the last moment they exist: the cascade
        -- from battlepack_calendar_adds runs as part of this delete.
        SELECT coalesce(jsonb_agg(a.user_id), '[]'::jsonb) INTO v_recipients
        FROM public.battlepack_calendar_adds a WHERE a.pack_id = old.id;

        PERFORM public.battlepack_post_change(jsonb_build_object(
            'event', 'deleted',
            'recipients', v_recipients,
            'pack', jsonb_build_object(
                'id', old.id, 'name', old.name, 'slug', old.slug,
                'starts_on', old.starts_on, 'ends_on', old.ends_on, 'starts_at', old.starts_at
            )
        ));
        RETURN old;
    END IF;

    PERFORM public.battlepack_post_change(jsonb_build_object(
        'event',   CASE WHEN new.status = 'published' THEN 'moved' ELSE 'withdrawn' END,
        'pack_id', new.id
    ));
    RETURN NULL;

EXCEPTION WHEN others THEN
    RAISE WARNING 'notify_battlepack_change failed: %', sqlerrm;
    RETURN CASE WHEN tg_op = 'DELETE' THEN old ELSE NULL END;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_notify_change ON public.battlepacks;
CREATE TRIGGER battlepacks_notify_change
    AFTER UPDATE OF status ON public.battlepacks
    FOR EACH ROW
    WHEN (old.status IS DISTINCT FROM new.status
      AND (old.status = 'published' OR new.status = 'published'))
    EXECUTE FUNCTION public.notify_battlepack_change();

-- The delete trigger is unchanged and still BEFORE, so the recipients can be
-- read while they certainly still exist.

-- ------------------------------------------------------------
-- BRING THE ENVELOPE UP TO DATE
--
-- Every pack, once, so the cache starts out agreeing with its segments rather
-- than only doing so after the next edit.
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT id FROM public.battlepacks LOOP
        PERFORM public.battlepack_sync_envelope(r.id);
    END LOOP;
END;
$$;
