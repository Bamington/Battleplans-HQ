-- ============================================================================
-- Give ZZ Their Venue a postcode
-- ============================================================================
--
-- The last venue deriving no region. It is hidden from regular users now
-- (20260828050000), but a venue with no region is never filtered out, so it
-- still turned up in every region's list for the one person who can see it.
--
-- Melbourne CBD, matching Test Venue (Safe) — both are the same person's
-- fixtures, and putting them in the same place means they appear together in
-- ordinary Victorian testing instead of following you into the NSW, UK, US and
-- NZ cases.
--
-- The address stays "1 Venue St"; it is not a real place, and the postcode
-- column is what the filter reads.
--
-- After this, every row of kind = 'venue' has a country and a postcode. The
-- three still without one are two clubs and a space, all deliberate: a club has
-- no address of its own and is already restricted to the people attached to it,
-- and a space is never offered in a picker at all.

update public.locations
   set postcode = '3000'
 where id = 'ea000000-0000-0000-0000-000000000002'   -- ZZ Their Venue
   and postcode is null;
