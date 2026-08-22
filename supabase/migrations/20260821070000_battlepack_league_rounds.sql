-- 20260821070000_battlepack_league_rounds.sql
--
-- A league's rounds are all the same length, and not everything in one is a
-- round.
--
-- Two facts a league needs that nothing currently holds. Both are additive with
-- defaults matching how every existing pack already behaves, so the deployed
-- app carries on unchanged and this is safe to apply ahead of the release —
-- the two-step every column addition needs on a database shared with
-- production.
--
-- ── Why the round length is one number on the PACK ───────────────────────────
--
-- Chris's call: every round in a league runs for the same number of weeks, and
-- changing it changes all of them at once. Stored on the pack rather than
-- inferred from the first segment's span, because inference breaks exactly when
-- it matters — the first segment might be an Event, or a round whose dates were
-- written before the length changed, and a league would then quietly disagree
-- with itself about how long a round is.
--
-- WEEKS, not days. "Two weeks per round" is what a league organiser says, and a
-- round length of ten days is not a thing anybody runs. It also keeps the
-- arithmetic exact: seven days times a whole number never lands mid-week.
--
-- ── Why a segment needs a KIND ───────────────────────────────────────────────
--
-- A league's timeline is rounds with the occasional something-else in it — a
-- painting week, a launch night, a break. Those are NOT rounds: they take no
-- round number, and their dates are the organiser's rather than computed.
--
-- The distinction has to be stored because it cannot be recovered. Guessing
-- from the label ("does it say break?") is the kind of rule that works until
-- somebody names a round "Breakthrough". Guessing from the dates fails as soon
-- as an Event happens to be exactly one round long.
--
-- AN EVENT OCCUPIES THE CALENDAR, which is the decision the layout rests on:
-- rounds run consecutively, and an Event's span is time they do not get to use,
-- so the rounds after it start later. That is what makes "week three is the
-- break week" expressible — you add an Event and everything behind it moves.
-- The alternative, an annotation that overlaps whatever round it lands in, was
-- considered and rejected: it cannot express a break at all.
--
-- Only meaningful for `schedule_shape = 'periods'`. A day in a tournament is a
-- day; there is nothing for it to be instead, so days keep the default and
-- nothing reads it.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.battlepacks
    ADD COLUMN IF NOT EXISTS round_length_weeks integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.battlepacks.round_length_weeks IS
  'How many weeks each of a league''s rounds runs for. ONE number for the whole league — every round is the same length, and changing it re-dates all of them. Only meaningful when schedule_shape = ''periods''.';

-- One to twelve. A round shorter than a week is a tournament day rather than a
-- league round, and a quarter-long round is a league with one round in it.
ALTER TABLE public.battlepacks
    DROP CONSTRAINT IF EXISTS battlepacks_round_length_weeks_check;
ALTER TABLE public.battlepacks
    ADD CONSTRAINT battlepacks_round_length_weeks_check
    CHECK (round_length_weeks BETWEEN 1 AND 12);

ALTER TABLE public.battlepack_schedule_segments
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'round';

COMMENT ON COLUMN public.battlepack_schedule_segments.kind IS
  '''round'' = play, and its dates are computed from the pack''s start and round_length_weeks. ''event'' = a painting week, a launch night, a break — no round number, dates set by the organiser, and it PUSHES the rounds after it later because it occupies that stretch of the calendar. Only meaningful when the pack''s schedule_shape is ''periods''; a tournament day is always ''round''.';

ALTER TABLE public.battlepack_schedule_segments
    DROP CONSTRAINT IF EXISTS battlepack_schedule_segments_kind_check;
ALTER TABLE public.battlepack_schedule_segments
    ADD CONSTRAINT battlepack_schedule_segments_kind_check
    CHECK (kind IN ('round', 'event'));

-- ------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT HERE
--
-- The layout itself. Which dates the rounds land on is computed in the app
-- ([leagues.ts](../../apps/battlepack/src/lib/leagues.ts)) and WRITTEN to the
-- segments, rather than derived by a trigger on read. Three reasons:
--
--   - the envelope, the public page, the calendar file and the change emails
--     all already read segment dates. A league whose dates existed only as a
--     formula would need every one of them taught to run it.
--   - the organiser has to see the dates before they save. A round length of
--     three weeks moving the league's end into December is the thing they are
--     deciding about, so the layout has to run in the form.
--   - an Event's dates are the organiser's own. Half the sequence is authored,
--     which makes it not a pure function of the pack anyway.
--
-- Recurrence is not restricted to single-day packs here either, though the app
-- now only offers it there. "One segment" is not something a row-level CHECK
-- can see, and a trigger that counted segments on every pack update would fire
-- on writes that have nothing to do with it. The one case the database CAN
-- state — that a league never repeats — it already states, in 20260821030000.
-- ------------------------------------------------------------
