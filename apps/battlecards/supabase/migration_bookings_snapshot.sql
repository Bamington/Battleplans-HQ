-- migration_bookings_snapshot.sql
--
-- Denormalise point-in-time booking details onto public.bookings so that later
-- edits to a location or timeslot (name, start/end time) don't retroactively
-- change what a historical booking displays. A booking is a record of a fact —
-- it should keep the details as they were when it was made.
--
-- The app now writes these on every new booking and reads them (preferring them
-- over the live join). Run once in the Supabase SQL editor for the shared project.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
-- Stored as text to mirror how the app already handles timeslot times ("HH:MM:SS").

alter table public.bookings
  add column if not exists location_name        text,
  add column if not exists timeslot_name        text,
  add column if not exists timeslot_start_time  text,
  add column if not exists timeslot_end_time    text;

-- ── 2. Backfill existing rows from the current live values ───────────────────
-- Idempotent: only fills rows that haven't been snapshotted yet.

update public.bookings b
set location_name       = l.name,
    timeslot_name       = t.name,
    timeslot_start_time = t.start_time::text,
    timeslot_end_time   = t.end_time::text
from public.locations l, public.timeslots t
where b.location_id = l.id
  and b.timeslot_id = t.id
  and b.location_name is null;
