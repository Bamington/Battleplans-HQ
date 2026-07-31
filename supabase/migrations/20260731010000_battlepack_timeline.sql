-- 20260731010000_battlepack_timeline.sql
--
-- Remember whether a pack is a one-day event, a multi-day one, or a league.
--
-- The create flow has always asked this — it is the three-card choice on step 2
-- — and has always thrown the answer away, because nothing downstream could use
-- it yet. Event Basics now can: a one-day event has no end date, so the field
-- should not be there to fill in wrongly rather than sitting empty with "leave
-- blank for a single day" underneath it.
--
-- Only 'one-day' is selectable today. The other two need a schedule spread
-- across dates, which battlepack_schedule_items models per-duration and not
-- per-day, so they are offered and disabled. Storing the column now means the
-- packs made in the meantime already say what they are, rather than needing a
-- backfill that would have to guess.
--
-- NOT NULL with a default rather than nullable: every pack is one of the three,
-- and every pack that exists today is a one-day one because that is the only
-- thing the flow would let anyone build. A nullable column would invite reading
-- "unknown" as a fourth state that never legitimately occurs.
--
-- Backward-compatible on the shared database. Postgres stores the default in
-- the catalogue rather than rewriting the table, and nothing reads the column
-- until BattlePack deploys.
--
-- Idempotent: safe to re-run.

alter table public.battlepacks
  add column if not exists timeline text not null default 'one-day';

comment on column public.battlepacks.timeline is
  'one-day | multi-day | league. Chosen at creation. Drives whether an end date is asked for — a one-day event has none. Only one-day is selectable until the schedule can span dates.';

alter table public.battlepacks
  drop constraint if exists battlepacks_timeline_check;

alter table public.battlepacks
  add constraint battlepacks_timeline_check
  check (timeline in ('one-day', 'multi-day', 'league'));
