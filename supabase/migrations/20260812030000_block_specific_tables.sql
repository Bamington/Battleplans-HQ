-- 20260812030000_block_specific_tables.sql
--
-- Block particular tables, not a headcount.
--
-- Until now a block said "three tables are unavailable" without saying which.
-- That was fine while every table was interchangeable. They aren't: tables have
-- purposes (a 6x4 wargaming table is not a TCG table), and a block on the
-- terrain table shouldn't quietly consume a card table's capacity.
--
-- Two consequences fall out of naming the tables, both improvements:
--
--   * A blocked table only reduces capacity in the timeslots THAT table serves.
--     The count model reduced every timeslot on the day equally, which was
--     wrong whenever tables had different availability.
--
--   * "Store closed" stays a separate idea from "these tables are out". Closing
--     the venue must also cover tables added next month, so it can't be stored
--     as a list of today's table ids — hence `table_scope`.
--
-- ── The compatibility problem ────────────────────────────────────────────────
--
-- `blocked_tables` is NOT dropped, and that is deliberate. Production is
-- currently serving 2.14.x, which computes availability by summing that column.
-- Dropping it — or leaving it null on new rows — would break booking
-- availability on the live site the moment this migration applied, well before
-- the code that understands the new model is deployed.
--
-- So the column stays as a derived mirror: the app writes the COUNT of selected
-- tables alongside the selection itself. Old code keeps subtracting the right
-- number of tables (just not the specific ones), new code uses the identities.
-- Once 2.15.0 is live everywhere, the column can be dropped in a later
-- migration. See [[feedback-shared-db-breaking-migrations]].
--
-- Idempotent: safe to re-run.

-- ── Scope ────────────────────────────────────────────────────────────────────
alter table public.blocked_dates
    add column if not exists table_scope text not null default 'all';

alter table public.blocked_dates
    drop constraint if exists blocked_dates_table_scope_check;
alter table public.blocked_dates
    add constraint blocked_dates_table_scope_check
    check (table_scope in ('all', 'selected'));

comment on column public.blocked_dates.table_scope is
  '''all'' = the whole venue is shut, including tables added later. ''selected'' = only the tables listed in blocked_date_tables.';

comment on column public.blocked_dates.blocked_tables is
  'LEGACY derived mirror: the number of tables this block covers. Kept only so pre-2.15 clients still compute capacity correctly; the authoritative set is blocked_date_tables. Drop once 2.15+ is everywhere.';

-- ── Which tables ─────────────────────────────────────────────────────────────
create table if not exists public.blocked_date_tables (
    blocked_date_id uuid not null references public.blocked_dates (id) on delete cascade,
    table_id        uuid not null references public.store_tables  (id) on delete cascade,
    primary key (blocked_date_id, table_id)
);

comment on table public.blocked_date_tables is
  'Which tables a block covers, when its table_scope is ''selected''.';

create index if not exists blocked_date_tables_table_id_idx
    on public.blocked_date_tables using btree (table_id);

alter table public.blocked_date_tables enable row level security;

-- Readable by everyone, like blocked_dates itself — availability is public.
drop policy if exists "Anyone can read blocked date tables" on public.blocked_date_tables;
create policy "Anyone can read blocked date tables"
    on public.blocked_date_tables for select
    to authenticated, anon
    using (true);

-- Written by whoever may write the parent block.
drop policy if exists "Admins and location admins can manage blocked date tables" on public.blocked_date_tables;
create policy "Admins and location admins can manage blocked date tables"
    on public.blocked_date_tables
    to authenticated
    using (
        public.is_platform_admin()
        or exists (
            select 1 from public.blocked_dates bd
            where bd.id = blocked_date_tables.blocked_date_id
              and public.is_location_admin(bd.location_id)
        )
    )
    with check (
        public.is_platform_admin()
        or exists (
            select 1 from public.blocked_dates bd
            where bd.id = blocked_date_tables.blocked_date_id
              and public.is_location_admin(bd.location_id)
        )
    );

-- ── Retire blocked_dates_future_check ────────────────────────────────────────
-- This check (`date >= current_date`, later exempting recurring rules) has now
-- blocked legitimate work twice: editing a running series, and the backfill
-- below, which fails on any block whose day has passed.
--
-- The cause is structural, not incidental. `current_date` is not immutable, so
-- a row that was valid when written silently becomes invalid once its date
-- passes — and from then on ANY update to it is rejected, including edits that
-- have nothing to do with the date. A store cannot fix a typo in the
-- description of last month's closure.
--
-- What it bought was small: it stopped someone creating a one-off block in the
-- past, which is a harmless mistake — availability only ever looks forward, so
-- such a row does nothing. That guard is better placed in the UI, where the
-- date picker already sets `min` to today for new one-offs, and where being
-- wrong costs a corrected click rather than a frozen record.
alter table public.blocked_dates
    drop constraint if exists blocked_dates_future_check;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- A NULL count already meant "the whole venue", which is exactly 'all' — those
-- rows need nothing. A numbered count named no tables, so there is no true
-- answer to recover; take the venue's first N by creation order. That keeps the
-- capacity arithmetic identical to what these blocks produce today, which is
-- the property worth preserving. Which specific tables is information that was
-- never recorded, and a store can now correct it by editing the block.
update public.blocked_dates
set table_scope = 'selected'
where blocked_tables is not null
  and table_scope <> 'selected';

insert into public.blocked_date_tables (blocked_date_id, table_id)
select bd.id, picked.id
from public.blocked_dates bd
cross join lateral (
    select st.id
    from public.store_tables st
    where st.location_id = bd.location_id
    order by st.created_at, st.id
    limit bd.blocked_tables
) picked
where bd.blocked_tables is not null
on conflict do nothing;
