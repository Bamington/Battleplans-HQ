-- 20260725000000_bookings_privacy_tighten.sql
--
-- The breaking half of the bookings privacy fix, applied at deploy time.
--
-- Until now `bookings` had a SELECT policy of `using (true)`, so any signed-in
-- user could read every booking row — including `user_name` and `user_email`.
-- This replaces it with owner / platform-admin / venue-admin.
--
-- It waited because it breaks the OLD availability check (a direct count over
-- `bookings`): under this policy that count sees only your own bookings, so
-- booked slots would show as free. The replacement reads the `booking_occupancy`
-- view instead, which is security_invoker = false and therefore unaffected.
--
-- Sequence actually followed:
--   1. PR #26 merged to main.
--   2. battleplan.app confirmed serving 2.12.0 (the booking_occupancy build).
--   3. This applied.
--
-- Recipients of a shared booking are unaffected: they read through
-- `my_incoming_booking_shares`, also security_invoker = false. Stores keep
-- access via the venue-admin clause.
--
-- Idempotent: safe to re-run.

-- Same shape as the existing DELETE policy: owner, platform admin, or an admin
-- of the venue the booking is at.
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
