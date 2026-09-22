-- ============================================================================
-- Test stores in three other countries, for exercising the region filter
-- ============================================================================
--
-- WHY THESE EXIST. Every real venue on the platform is Victorian, so the region
-- filter currently has nothing to hide and cannot be seen working. These three
-- give it something to exclude.
--
-- WHY THEY ARE SAFE ON THE SHARED DATABASE. One database sits behind production
-- and every preview, so anything inserted here is inserted into production.
-- Both guards that matter are set:
--
--   is_test = true   Hidden from anonymous readers and from every signed-in
--                    user who is not attached to the venue. Note this is NOT a
--                    platform-admin bypass — the read policy grants nothing to
--                    admins as such — which is why Chris's id is in `admins`
--                    below. Without it he could not see them either.
--
--   store_email      Chris's own address, matching the existing test venues.
--                    Booking mail for a test store must never reach a stranger.
--
-- They have no tables and no timeslots, so nothing can actually be booked at
-- one. That is deliberate: the thing under test is whether they APPEAR in the
-- venue picker, and a bookable test store in production is a larger promise
-- than this needs to make.
--
-- REMOVING THEM is a plain delete by id — they own no bookings and nothing
-- references them:
--   delete from public.locations where id in (
--     '7e570000-0000-4000-a000-000000000001',
--     '7e570000-0000-4000-a000-000000000002',
--     '7e570000-0000-4000-a000-000000000003');

insert into public.locations (id, name, address, country, postcode, kind, is_test, store_email, admins)
values
  ('7e570000-0000-4000-a000-000000000001',
   'Test Store USA',         '1 Test Street, New York, NY 10001',
   'US', '10001',   'venue', true, 'chris.bam.harrison@gmail.com',
   array['c0fab326-f180-4fe6-bf1b-87c069be3794']::uuid[]),

  ('7e570000-0000-4000-a000-000000000002',
   'Test Store England',     '1 Test Street, London SW1A 1AA',
   -- Stored the way normalisePostcode writes it: uppercase, no spaces. A value
   -- with a space would still resolve to 'GB', but would not match a user's
   -- stored postcode character for character if anything ever compares them.
   'GB', 'SW1A1AA', 'venue', true, 'chris.bam.harrison@gmail.com',
   array['c0fab326-f180-4fe6-bf1b-87c069be3794']::uuid[]),

  ('7e570000-0000-4000-a000-000000000003',
   'Test Store New Zealand', '1 Test Street, Wellington 6011',
   'NZ', '6011',    'venue', true, 'chris.bam.harrison@gmail.com',
   array['c0fab326-f180-4fe6-bf1b-87c069be3794']::uuid[])

-- Fixed ids so re-running changes nothing and so the delete above is exact.
on conflict (id) do nothing;
