-- 20260817030000_booking_table_label.sql
--
-- A booking says which kind of table it took.
--
-- Capacity has always been one number per timeslot: how many enabled tables
-- serve it, minus how many bookings exist. That works while every table is
-- interchangeable. Now that a table carries a free-text `label`
-- (20260817010000), a venue with six wargaming tables and two painting benches
-- has two capacities, and one shared counter overstates both — six people can
-- book "a table" and leave the painting benches nominally free while the
-- wargaming tables are three times oversubscribed.
--
-- So a booking records the label it was made against, and capacity is counted
-- per label.
--
-- NULL MEANS "ANY", and every existing booking is null. That is the honest
-- reading: they were made when a table was a table, and inventing a label for
-- them would be making up history. A venue with one kind of table never asks
-- the question and keeps writing nulls, which is why nothing about the simple
-- case changes.
--
-- TEXT, NOT A FOREIGN KEY TO A TABLE. The booking is for a KIND of table, not a
-- particular one — the venue decides which physical table on the day, as it
-- always has. Pointing at `store_tables.id` would promise an allocation this
-- app does not do, and would break the moment a venue retired that table.
--
-- Idempotent: safe to re-run.

alter table public.bookings
  add column if not exists table_label text;

comment on column public.bookings.table_label is
  'Which kind of table this booking is for, matching store_tables.label. NULL means any — every booking made before a venue had more than one kind. Free text rather than a table id: the booking is for a kind, not an allocation.';

-- Capacity is counted per (location, date, timeslot, label).
create index if not exists bookings_capacity_idx
  on public.bookings (location_id, date, timeslot_id, table_label);

-- ── The occupancy view has to carry it ───────────────────────────────────────
--
-- `booking_occupancy` is how a regular user sees how full a slot is without
-- being able to read anyone's booking — see 20260804020000. Counting per label
-- through it means the view has to expose the label, and only the label: still
-- no name, no email, no game, nothing that identifies a person.
--
-- Recreated rather than altered; a view's column list cannot be extended in
-- place.

drop view if exists public.booking_occupancy;

create view public.booking_occupancy
with (security_invoker = false) as
  select id, location_id, date, timeslot_id, table_label
  from public.bookings;

comment on view public.booking_occupancy is
  'How full a slot is, without who. Exposes only the columns capacity needs — now including table_label, so a venue with several kinds of table counts each separately.';

grant select on public.booking_occupancy to authenticated, anon;
