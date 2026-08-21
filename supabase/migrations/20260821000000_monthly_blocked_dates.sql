-- 20260821000000_monthly_blocked_dates.sql
--
-- "First Friday of the month", and "last Saturday".
--
-- 20260812020000 gave blocked_dates a weekly rule, which covers every week and
-- every second week and nothing else. A club that meets on the first Friday of
-- the month has had no way to say so — the interval is not a number of weeks,
-- because months are not a whole number of weeks long.
--
-- BY WEEKDAY, NOT BY DATE. "The 12th" drifts across the week and is almost
-- never what a club night means; "the first Friday" is. So the rule keeps
-- `days_of_week` and adds WHICH occurrence of it in the month.
--
-- ── The dangerous thing here ─────────────────────────────────────────────────
--
-- These columns feed blockAppliesOn → blockedTablesOn → dayHasCapacity, which
-- decides whether any customer can book at any venue. The same warning is on
-- 20260814040000 and it has not got less true.
--
-- Two things keep that safe. The new column is nullable and every existing row
-- gets NULL, so nothing already stored changes meaning. And the client treats
-- recurrence as an ALLOWLIST — anything it does not recognise falls back to
-- "applies on its own date only" — so a row written by a newer client than the
-- one reading it blocks too little rather than closing a shop that is open.
--
-- -1 for "last" rather than 5. The fifth Friday exists in some months and not
-- others, so a rule saying 5 would silently skip most of the year, whereas
-- "last" is what people mean and always resolves.
--
-- interval_weeks is meaningless here and is pinned to 1 rather than left to
-- carry a value nothing reads. "Every second month" is not offered; when it is
-- wanted it should be interval_months, not this column doing double duty.
--
-- Purely additive. Idempotent: safe to re-run.

alter table public.blocked_dates
    add column if not exists week_of_month integer;

comment on column public.blocked_dates.week_of_month is
  'Which occurrence of `days_of_week` within the month a monthly rule means: 1-4 for first through fourth, -1 for the last. NULL for every other recurrence.';

-- ── Shape ────────────────────────────────────────────────────────────────────

alter table public.blocked_dates
    drop constraint if exists blocked_dates_recurrence_check;
alter table public.blocked_dates
    add constraint blocked_dates_recurrence_check
    check (recurrence in ('none', 'weekly', 'monthly'));

-- Set for a monthly rule, absent for anything else. Both directions, so a rule
-- can neither be monthly without saying which week nor carry a stale week after
-- being switched back to weekly.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_week_of_month_check;
alter table public.blocked_dates
    add constraint blocked_dates_week_of_month_check
    check (
        (recurrence = 'monthly' and week_of_month in (1, 2, 3, 4, -1))
     or (recurrence <> 'monthly' and week_of_month is null)
    );

-- Weeks are not how a monthly rule counts. Pinned rather than ignored.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_monthly_interval_check;
alter table public.blocked_dates
    add constraint blocked_dates_monthly_interval_check
    check (recurrence <> 'monthly' or interval_weeks = 1);

-- Extends the rule from 20260812020000: a repeating rule with no weekday would
-- block nothing while looking like it blocks something, and that is as true
-- monthly as it is weekly.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_recurrence_shape_check;
alter table public.blocked_dates
    add constraint blocked_dates_recurrence_shape_check
    check (
        (recurrence = 'none'    and cardinality(days_of_week) = 0)
     or (recurrence = 'weekly'  and cardinality(days_of_week) > 0)
     or (recurrence = 'monthly' and cardinality(days_of_week) > 0)
    );
