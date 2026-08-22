-- 20260818030000_fee_table_labels.sql
--
-- A booking fee can name the table types it applies to.
--
-- 20260817010000 turned `store_tables.size` (Wargaming | TCG) into a free-text
-- `label`, so a venue can now have any set of table types — and the moment it
-- does, one price for all of them stops being true. A shop with six wargaming
-- tables and two Magic tables charges differently for them.
--
-- `table_labels` is the set of `store_tables.label` values a fee covers:
--
--   NULL  — every table type. What every existing row means, and what a venue
--           with one kind of table will always mean.
--   {...} — only bookings of a table whose label is in the set.
--
-- Labels rather than table ids on purpose. The fee is a property of the TYPE
-- ("$15 for a Magic table"), not of table #4; ids would break every fee the
-- first time a venue replaced a table, and the booking flow already asks the
-- player for a type rather than a table.
--
-- ── Uniqueness has to widen ──────────────────────────────────────────────────
-- The point of the feature is "$10 a table, $15 for TCG" — two DEFAULT-scope
-- rules at one venue, which the old partial unique index forbade outright. So
-- the three keys gain the table set, via an immutable helper that normalises it
-- (order-independent, null and {} the same). Two rules can now share a scope as
-- long as they cover different types; an exact duplicate is still rejected.
--
-- ── Safe on the shared database ──────────────────────────────────────────────
-- Additive, and every existing row keeps its meaning: NULL reads as "all types"
-- and normalises to the same key it had before, so no venue can suddenly have
-- two conflicting defaults. An OLD client writing a fee sends no table_labels
-- and gets NULL — still correct.
--
-- The one thing an old client does wrong is READ: it ignores table_labels, so a
-- TCG-only fee would be shown to someone booking a wargaming table. That only
-- happens once a store uses the new control, which cannot happen before the app
-- that adds it ships — so the window is closed by deploy order, not by luck.
--
-- Idempotent: safe to re-run.

-- ── Column ───────────────────────────────────────────────────────────────────
alter table public.location_booking_fees
    add column if not exists table_labels text[];

comment on column public.location_booking_fees.table_labels is
  'store_tables.label values this fee applies to. NULL means every table type.';

-- An empty array is the same claim as NULL made confusingly, so it is not
-- allowed — "all types" has exactly one spelling.
alter table public.location_booking_fees
    drop constraint if exists location_booking_fees_table_labels_check;
alter table public.location_booking_fees
    add constraint location_booking_fees_table_labels_check
    check (table_labels is null or array_length(table_labels, 1) >= 1);

-- ── Normalised key, so the unique indexes can compare table sets ─────────────
-- Sorted and joined, because {'TCG','Wargaming'} and {'Wargaming','TCG'} are
-- the same rule. NULL and {} both flatten to '' — the "all types" key, which is
-- what every pre-existing row hashes to.
create or replace function public.fee_table_key(labels text[])
returns text
language sql
immutable
set search_path = public
as $$
    select coalesce(array_to_string(array(select unnest(labels) order by 1), '|'), '');
$$;

comment on function public.fee_table_key(text[]) is
  'Order-independent key for a fee''s table_labels. Immutable, so the fee unique indexes can be built on it.';

-- ── Uniqueness, now per (target, table set) ──────────────────────────────────
-- Dropped and rebuilt rather than added alongside: the old two-column indexes
-- are exactly the constraint being relaxed, so leaving them in place would keep
-- rejecting the rows this migration exists to allow.
drop index if exists public.location_booking_fees_default_key;
create unique index if not exists location_booking_fees_default_key
    on public.location_booking_fees (location_id, public.fee_table_key(table_labels))
    where scope = 'default';

drop index if exists public.location_booking_fees_day_key;
create unique index if not exists location_booking_fees_day_key
    on public.location_booking_fees (location_id, day_of_week, public.fee_table_key(table_labels))
    where scope = 'day';

drop index if exists public.location_booking_fees_timeslot_key;
create unique index if not exists location_booking_fees_timeslot_key
    on public.location_booking_fees (location_id, timeslot_id, public.fee_table_key(table_labels))
    where scope = 'timeslot';
