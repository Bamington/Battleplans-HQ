-- 20260812020000_recurring_blocked_dates.sql
--
-- Recurring table blocks: "every Monday", "every second Friday until December".
--
-- A recurrence RULE, not expanded rows. Writing out every occurrence would mean
-- picking an arbitrary horizon, re-expanding whenever it moved, and editing a
-- series by finding and rewriting all its children. A rule is one row: change
-- it once and every future occurrence changes with it, and "until further
-- notice" needs no horizon at all.
--
-- The existing `date` column becomes the series START for a recurring rule, and
-- keeps meaning exactly what it did for a one-off. So every existing row is
-- already correct under the new reading, with recurrence='none'.
--
-- Occurrences are computed where availability is computed — in the client,
-- alongside the timeslot and booking logic that already lives there. Nothing
-- here needs the database to expand anything.
--
-- Purely additive: new columns with defaults matching current behaviour.
--
-- Idempotent: safe to re-run.

-- ── Columns ──────────────────────────────────────────────────────────────────
alter table public.blocked_dates
    add column if not exists recurrence     text    not null default 'none',
    add column if not exists interval_weeks integer not null default 1,
    add column if not exists days_of_week   text[]  not null default array[]::text[],
    add column if not exists until_date     date;

comment on column public.blocked_dates.recurrence is
  '''none'' = blocks the single day in `date`. ''weekly'' = blocks every `interval_weeks` weeks on `days_of_week`, from the week of `date` until `until_date` (or forever).';
comment on column public.blocked_dates.date is
  'The blocked day for a one-off; the first day of the series for a recurring rule.';
comment on column public.blocked_dates.interval_weeks is
  '1 = every week, 2 = every second week, and so on. Counted from the week containing `date`.';
comment on column public.blocked_dates.until_date is
  'Last day the rule can apply. NULL means it runs until deleted.';

-- ── Shape ────────────────────────────────────────────────────────────────────
alter table public.blocked_dates
    drop constraint if exists blocked_dates_recurrence_check;
alter table public.blocked_dates
    add constraint blocked_dates_recurrence_check
    check (recurrence in ('none', 'weekly'));

alter table public.blocked_dates
    drop constraint if exists blocked_dates_interval_check;
alter table public.blocked_dates
    add constraint blocked_dates_interval_check
    check (interval_weeks between 1 and 12);

-- Full day names, matching timeslots.availability so both sides of the
-- availability calculation speak the same language.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_days_check;
alter table public.blocked_dates
    add constraint blocked_dates_days_check
    check (days_of_week <@ array[
        'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday', 'Sunday'
    ]::text[]);

-- A weekly rule with no days would block nothing while looking like it blocks
-- something. A one-off carries no days at all.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_recurrence_shape_check;
alter table public.blocked_dates
    add constraint blocked_dates_recurrence_shape_check
    check (
        (recurrence = 'none'   and cardinality(days_of_week) = 0)
     or (recurrence = 'weekly' and cardinality(days_of_week) > 0)
    );

alter table public.blocked_dates
    drop constraint if exists blocked_dates_until_check;
alter table public.blocked_dates
    add constraint blocked_dates_until_check
    check (until_date is null or until_date >= date);

-- ── Let a running series be edited ───────────────────────────────────────────
-- The original check (`date >= CURRENT_DATE`) stopped anyone blocking a day
-- that had already passed. Harmless for one-offs, but fatal for recurrences:
-- a rule started in March has a March `date` forever, so from April onwards any
-- UPDATE to it — changing its days, its end date, even its description —
-- violates the check and the store can no longer edit its own rule.
--
-- Replaced with a version that exempts recurring rules, keeping the original
-- intent (don't create a pointless one-off in the past) without freezing a
-- series the moment it starts.
--
-- NOT VALID, and that is not laziness. `current_date` is not immutable, so a
-- row that satisfied this check when written stops satisfying it once the day
-- passes — three of the seven rows in this table are already in that state.
-- A validating ADD CONSTRAINT re-checks every existing row and would abort the
-- migration on them. NOT VALID applies the rule to inserts and updates from
-- here on and leaves history alone, which is the only coherent reading of a
-- constraint whose truth depends on today's date.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_future_check;
alter table public.blocked_dates
    add constraint blocked_dates_future_check
    check (recurrence <> 'none' or date >= current_date)
    not valid;
