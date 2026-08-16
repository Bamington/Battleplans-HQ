-- 20260814040000_timeslot_recurrence.sql
--
-- Every second Friday.
--
-- `timeslots.availability` holds weekday names, which says WHICH day but not
-- WHICH WEEKS. A shop open every Friday is served perfectly; a club that meets
-- fortnightly has had no way to say so, and the nearest workaround was blocking
-- every alternate week by hand, forever.
--
-- THIS IS THE OPPOSITE OF blocked_dates. That table already has recurrence, but
-- it recurs a CLOSURE. This recurs an OPENING, and the two are read by the same
-- capacity code — a date has to survive both to be bookable.
--
-- ── The one dangerous thing here ─────────────────────────────────────────────
--
-- These columns feed `dayHasCapacity`, which decides whether ANY customer can
-- book at ANY venue. Getting it wrong closes shops that are open.
--
-- So the default is deliberately inert: `interval_weeks = 1` means every
-- matching weekday, which is exactly what every existing row already means. No
-- backfill, no behaviour change, and a venue that never touches this feature
-- resolves the way it always did.
--
-- `anchor_date` is which occurrence to count from — without one, "every second
-- Friday" cannot say WHICH Friday. It is only consulted when interval_weeks > 1,
-- and the check below makes it impossible to ask for a cycle without naming its
-- starting point.
--
-- Idempotent: safe to re-run.

alter table public.timeslots
  add column if not exists interval_weeks integer not null default 1;

alter table public.timeslots
  add column if not exists anchor_date date;

alter table public.timeslots
  drop constraint if exists timeslots_interval_weeks_check;

alter table public.timeslots
  add constraint timeslots_interval_weeks_check
  check (interval_weeks >= 1 and interval_weeks <= 8);

-- A cycle with no starting point is not a cycle. Weekly needs no anchor, so the
-- rule only bites where it means something.
alter table public.timeslots
  drop constraint if exists timeslots_anchor_required_when_repeating;

alter table public.timeslots
  add constraint timeslots_anchor_required_when_repeating
  check (interval_weeks = 1 or anchor_date is not null);

comment on column public.timeslots.interval_weeks is
  'How many weeks between occurrences. 1 = every matching weekday, which is what every row meant before this column existed.';

comment on column public.timeslots.anchor_date is
  'A date this slot actually runs, to count the cycle from. Required once interval_weeks > 1, meaningless when it is 1.';

-- ── Where a club meets ───────────────────────────────────────────────────────
--
-- Tables and timeslots belong to the CLUB, not to the room — a club is a group
-- of people who bring their own capacity, and modelling it the other way would
-- have pushed bookings, stats and the store view onto the space and made a club
-- an empty shell that owns nothing.
--
-- What the club still needs from the room is its ADDRESS, so a member knows
-- where to turn up. That is all this is: a pointer for display.
--
-- Clubs only. A venue and a space each have an address of their own, and a
-- venue pointing at a room it is not in would be a lie waiting to be rendered.

alter table public.locations
  add column if not exists meets_at_id uuid references public.locations (id) on delete set null;

alter table public.locations
  drop constraint if exists locations_meets_at_clubs_only;

alter table public.locations
  add constraint locations_meets_at_clubs_only
  check (meets_at_id is null or kind = 'club');

comment on column public.locations.meets_at_id is
  'For a club, the space it meets at — used for the address only. Tables and timeslots stay on the club. SET NULL on delete: losing the room does not delete the club.';

create index if not exists locations_meets_at_id_idx
  on public.locations (meets_at_id)
  where meets_at_id is not null;
