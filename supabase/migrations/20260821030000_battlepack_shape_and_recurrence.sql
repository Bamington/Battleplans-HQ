-- 20260821030000_battlepack_shape_and_recurrence.sql
--
-- How the schedule is laid out, and how often the whole thing happens.
--
-- `timeline` is one enum — one-day | multi-day | league — and it conflates two
-- independent questions. A monthly weekender needs both answers at once, and no
-- fourth value can give them: adding 'recurring' would make a repeating two-day
-- event unrepresentable, which is the test case that showed the enum was the
-- wrong shape.
--
-- So it becomes two facts:
--
--   schedule_shape   days | periods
--   recurrence       none | weekly | monthly, plus its rule
--
-- ONE-DAY IS NOT A SHAPE. It is `days` with a single segment, which is what
-- makes growing a one-dayer into a two-dayer an insert rather than a conversion
-- — see 20260821010000, where every pack got its segment. The count is the
-- fact; nothing stores "this is a one-day event".
--
-- ── The recurrence rule is blocked_dates' rule, deliberately ─────────────────
--
-- Same column names, same meanings, same domain for the weekday array. A
-- recurring pack holds its venue's tables by writing exactly one recurring
-- `blocked_dates` row, so the two speaking different dialects would mean a
-- translation layer between them and a class of bug where the event and its
-- table hold disagree about which Fridays. `week_of_month` is the one added by
-- 20260821000000 for the same reason: months are not a whole number of weeks.
--
-- ── until_date is REQUIRED when recurring, and pays for itself ───────────────
--
-- Chris's call, and it removes a problem rather than adding a rule. A bounded
-- series means the pack's `ends_on` can hold the last occurrence, so
-- BattlePlan's `eventIsUpcoming` — which reads `ends_on ?? starts_on` — keeps
-- working untouched. An open-ended series would have made every consumer of
-- that column recurrence-aware.
--
-- ── `timeline` stays for now ────────────────────────────────────────────────
--
-- The deployed app reads it: EventBasicsForm decides whether to ask for an end
-- date from it, and NewPackModal writes it. It is dropped in the migration that
-- follows the app deploy, which is the second half of the two-step every
-- column removal needs on a database shared with production.
--
-- The two are NOT cross-checked while both exist. A constraint tying a dying
-- column to its replacement is machinery that has to be removed again, and they
-- agree by construction: every pack today is one-day, and the only value the
-- deployed create flow can send is 'one-day' — the other two cards are
-- disabled. The mapping when the new flow lands is: one-day and multi-day are
-- both `days`; league is `periods`.
--
-- Purely additive: six columns, all with defaults matching today's behaviour,
-- and nothing reads them yet. Idempotent: safe to re-run.

ALTER TABLE public.battlepacks
    ADD COLUMN IF NOT EXISTS schedule_shape text    NOT NULL DEFAULT 'days',
    ADD COLUMN IF NOT EXISTS recurrence     text    NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS interval_weeks integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS days_of_week   text[]  NOT NULL DEFAULT ARRAY[]::text[],
    ADD COLUMN IF NOT EXISTS week_of_month  integer,
    ADD COLUMN IF NOT EXISTS until_date     date;

COMMENT ON COLUMN public.battlepacks.schedule_shape IS
  'days = a sequence of dated days, each with its own timetable (one-day is simply one of them). periods = a league''s labelled date ranges, which have no clock times. Replaces the layout half of `timeline`.';
COMMENT ON COLUMN public.battlepacks.recurrence IS
  '''none'' = happens once. ''weekly'' = every `interval_weeks` weeks on `days_of_week`. ''monthly'' = the `week_of_month`-th `days_of_week` of each month. Same vocabulary as blocked_dates, so a recurring pack''s table hold is one rule rather than a translation.';
COMMENT ON COLUMN public.battlepacks.until_date IS
  'Last day the series can run, and REQUIRED when recurring. A bounded series is what lets battlepacks.ends_on hold the final occurrence, which is what keeps every existing reader of that column working.';

-- ── Domains ──────────────────────────────────────────────────────────────────

ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_schedule_shape_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_schedule_shape_check
    CHECK (schedule_shape IN ('days', 'periods'));

ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_recurrence_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_recurrence_check
    CHECK (recurrence IN ('none', 'weekly', 'monthly'));

ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_interval_weeks_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_interval_weeks_check
    CHECK (interval_weeks BETWEEN 1 AND 12);

-- Full day names, matching blocked_dates and timeslots.availability, so every
-- side of a recurring event speaks the same language.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_days_of_week_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_days_of_week_check
    CHECK (days_of_week <@ ARRAY[
        'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday', 'Sunday'
    ]::text[]);

-- ── Shape ────────────────────────────────────────────────────────────────────

-- A repeating event with no weekday repeats on no days, which is a series that
-- never happens. A one-off carries no pattern at all, so switching back to
-- "does not repeat" cannot leave days behind for the next edit to resurrect.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_recurrence_shape_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_recurrence_shape_check
    CHECK (
        (recurrence = 'none' AND cardinality(days_of_week) = 0)
     OR (recurrence <> 'none' AND cardinality(days_of_week) > 0)
    );

-- Set for a monthly rule, absent otherwise. Both directions, so a rule can
-- neither be monthly without saying which week nor carry a stale week after
-- being switched back. -1 is "last", never "fifth" — see 20260821000000.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_week_of_month_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_week_of_month_check
    CHECK (
        (recurrence = 'monthly' AND week_of_month IN (1, 2, 3, 4, -1))
     OR (recurrence <> 'monthly' AND week_of_month IS NULL)
    );

-- Weeks are not how a monthly rule counts. Pinned rather than left carrying a
-- number nothing reads; "every second month" would be interval_months, not
-- this column doing double duty.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_monthly_interval_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_monthly_interval_check
    CHECK (recurrence <> 'monthly' OR interval_weeks = 1);

-- The end date is the point. Enforced here rather than in the form, because
-- every reader of `ends_on` now depends on a series being bounded.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_recurrence_until_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_recurrence_until_check
    CHECK (recurrence = 'none' OR until_date IS NOT NULL);

-- A league's periods ARE its schedule; "a league that repeats fortnightly" is
-- not a thing anybody means. A constraint rather than a convention, because the
-- calendar and the notification rules both branch on it and neither has a
-- sensible answer for the combination.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_recurring_days_only_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_recurring_days_only_check
    CHECK (recurrence = 'none' OR schedule_shape = 'days');

-- ------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT HERE
--
-- The envelope cache. The settled design makes starts_on / ends_on / starts_at
-- derived from the segments, but 20260821010000 currently mirrors them the
-- other way, because the deployed app can only edit the pack. Flipping the
-- direction means dropping that mirror, adding the segments-side notification
-- trigger, and teaching ends_on to resolve a recurring series' last occurrence
-- — all of which have to land with the app that writes segments, not before it.
--
-- Nothing reads these six columns yet either. They exist now so the packs
-- created between this migration and that deploy already say what they are,
-- which is the same reason `timeline` was added ahead of use in 20260731010000.
-- ------------------------------------------------------------
