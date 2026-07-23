-- 20260723020000_bookings_privacy_tighten.sql
--
-- ⚠️  DEPLOY-TIME ONLY. DO NOT APPLY to the shared database until the code that
--     reads `booking_occupancy` for availability (useTableAvailability) is LIVE
--     IN PRODUCTION.
--
-- This is the breaking half of the bookings privacy fix. It stops a regular
-- user reading anyone else's bookings — which also stops the OLD availability
-- check (a direct count over `bookings`) from seeing other people's bookings,
-- making it under-count and show full slots as free. Prod runs that old code
-- until the friends branch is merged and deployed, so applying this before then
-- regresses live booking.
--
-- Safe apply sequence:
--   1. Merge the branch → main, let Vercel deploy battleplan.app.
--   2. Confirm prod is serving the build that reads booking_occupancy.
--   3. Apply this migration.
-- (New code works under either policy, so the brief window between 2 and 3 is
--  fine — this only needs the OLD code gone.)
--
-- Idempotent: safe to re-run.

-- Same shape as the existing DELETE policy: owner, platform admin, or an admin
-- of the venue the booking is at. Booking-sharing (a later migration) extends
-- this with the shared-with user.
drop policy if exists "Users can read all bookings for availability" on public.bookings;
drop policy if exists "Read own, admin, or venue-admin bookings" on public.bookings;
create policy "Read own, admin, or venue-admin bookings"
  on public.bookings for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
    or exists (
      select 1 from public.locations
      where locations.id = bookings.location_id
        and locations.admins @> array[auth.uid()]
    )
  );
