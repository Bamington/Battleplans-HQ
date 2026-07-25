-- 20260723010000_bookings_privacy.sql
--
-- Part 1 of closing the bookings privacy hole: the ADDITIVE half, safe to run on
-- the shared database while old code is still deployed.
--
-- Background: the bookings SELECT policy is `to authenticated using (true)` —
-- every signed-in user can read every booking, including `user_name` (a private
-- "Your Name") and `user_email`. Closing that means the SELECT policy can no
-- longer let a regular user read other people's bookings — but the booking form
-- reads exactly that to compute slot AVAILABILITY (how many tables are taken).
--
-- So availability is decoupled first: `booking_occupancy` exposes only
-- (location, date, timeslot) with no identity, and the booking form reads it
-- instead of `bookings`. This view is harmless to old code (which ignores it),
-- so it can live on the shared DB now.
--
-- The breaking half — actually tightening the SELECT policy — is a SEPARATE
-- migration (20260723020000) that MUST NOT be applied until the code reading
-- booking_occupancy is live in production, or prod's old availability check
-- silently under-counts. See that file's header.
--
-- Idempotent: safe to re-run.

-- security_invoker = false so it runs as owner and sees every booking's slot,
-- past the (eventual) tightened row policy. It exposes nothing sensitive — only
-- that a table slot is occupied, which is all availability needs.
drop view if exists public.booking_occupancy;
create view public.booking_occupancy
with (security_invoker = false) as
  select id, location_id, date, timeslot_id
  from public.bookings;

alter view public.booking_occupancy owner to postgres;

comment on view public.booking_occupancy is
  'Identity-free slot occupancy (location_id, date, timeslot_id) for availability maths. No user_name / user_email / user_id — those stay on bookings.';

revoke all on public.booking_occupancy from anon, authenticated;
grant select on public.booking_occupancy to authenticated;
