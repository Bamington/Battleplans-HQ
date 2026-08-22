-- 20260821060000_battlepack_change_detail.sql
--
-- Give the email enough to say WHICH day moved, and add the fourth kind.
--
-- `battlepack_stale_calendar_adds` returns the first day a person is holding
-- and the pack's current signature as an opaque string. That was enough while
-- an event was one day. It is not enough to write "Day 2 has moved from Sunday
-- 20 September to Sunday 27 September", which needs both schedules whole.
--
-- So it returns both arrays. The five existing columns keep their names, types
-- and meanings — `send-pack-change-notification` is deployed and reads them,
-- and this migration goes out before the function does. Extra keys are ignored
-- by the running version and used by the next.
--
-- DROP and CREATE rather than CREATE OR REPLACE, because the return type
-- changes. That drops the grants with it, so they are restated below —
-- including the anon revoke that 20260820000100 exists to enforce.
--
-- ── The fourth email ─────────────────────────────────────────────────────────
--
-- 'extended' is a recurring series gaining occurrences. It is not a move: every
-- date already in somebody's calendar is still correct, and telling them their
-- date changed would be wrong as well as alarming. Different news, different
-- message.
--
-- The rule is deliberately narrow. Only `until_date` moving LATER, with every
-- other part of the rule untouched, is an extension. A rule that changed shape
-- — a different weekday, a different interval, a series shortened — invalidates
-- what people hold, and that is a move.
--
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- BOTH SCHEDULES, WHOLE
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.battlepack_stale_calendar_adds(uuid);

CREATE FUNCTION public.battlepack_stale_calendar_adds(pack uuid)
RETURNS TABLE (
  user_id         uuid,
  -- The compatibility shim: the first day of what they hold. Exact while a
  -- pack has one segment, and read by the currently deployed function.
  held_starts_on  date,
  held_ends_on    date,
  held_starts_at  time,
  signature       text,
  -- What the next version reads. The whole of both sides, so the email can
  -- name the days that differ rather than announcing that something did.
  held_schedule     jsonb,
  current_schedule  jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id,
         (a.held_schedule -> 0 ->> 'on')::date,
         NULL::date,
         (a.held_schedule -> 0 ->> 'at')::time,
         public.battlepack_schedule_signature(a.pack_id)::text,
         a.held_schedule,
         public.battlepack_schedule_signature(a.pack_id)
  FROM public.battlepack_calendar_adds a
  JOIN public.battlepacks p ON p.id = a.pack_id
  WHERE a.pack_id = pack
    AND p.status = 'published'
    AND a.held_schedule IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id)
    AND a.notified_schedule IS DISTINCT FROM public.battlepack_schedule_signature(a.pack_id);
$$;

REVOKE ALL ON FUNCTION public.battlepack_stale_calendar_adds(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.battlepack_stale_calendar_adds(uuid) TO service_role;

-- ------------------------------------------------------------
-- A SERIES THAT GREW
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_battlepack_recurrence_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
    v_event text;
BEGIN
    IF new.status <> 'published' THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.battlepack_calendar_adds a WHERE a.pack_id = new.id
    ) THEN
        RETURN NULL;
    END IF;

    -- Narrow on purpose: the same rule, running longer. Anything else about the
    -- pattern changing means the dates people hold may no longer be right.
    IF  old.recurrence     IS NOT DISTINCT FROM new.recurrence
    AND old.interval_weeks IS NOT DISTINCT FROM new.interval_weeks
    AND old.days_of_week   IS NOT DISTINCT FROM new.days_of_week
    AND old.week_of_month  IS NOT DISTINCT FROM new.week_of_month
    AND old.until_date IS NOT NULL AND new.until_date IS NOT NULL
    AND new.until_date > old.until_date
    THEN
        v_event := 'extended';
    ELSE
        v_event := 'moved';
    END IF;

    PERFORM public.battlepack_post_change(
        jsonb_build_object('event', v_event, 'pack_id', new.id)
    );
    RETURN NULL;

EXCEPTION WHEN others THEN
    RAISE WARNING 'notify_battlepack_recurrence_change failed: %', sqlerrm;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_notify_recurrence ON public.battlepacks;
CREATE TRIGGER battlepacks_notify_recurrence
    AFTER UPDATE OF recurrence, interval_weeks, days_of_week, week_of_month, until_date
    ON public.battlepacks
    FOR EACH ROW
    WHEN (old.recurrence     IS DISTINCT FROM new.recurrence
       OR old.interval_weeks IS DISTINCT FROM new.interval_weeks
       OR old.days_of_week   IS DISTINCT FROM new.days_of_week
       OR old.week_of_month  IS DISTINCT FROM new.week_of_month
       OR old.until_date     IS DISTINCT FROM new.until_date)
    EXECUTE FUNCTION public.notify_battlepack_recurrence_change();

-- Note for whoever adds the recurrence UI: this fires alongside nothing else.
-- The rule columns are not in the segments trigger's watch list and not in the
-- pack trigger's, which now only watches `status` — so a rule change sends
-- exactly one message.
