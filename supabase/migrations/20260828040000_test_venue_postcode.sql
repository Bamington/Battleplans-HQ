-- ============================================================================
-- Give Test Venue (Safe) a postcode
-- ============================================================================
--
-- A venue with no postcode derives no region, and no region means the filter
-- never excludes it — by design, so that a club or a half-filled row keeps
-- working. The cost is that such a venue turns up in EVERY region's list, which
-- made Test Venue (Safe) a noisy neighbour in exactly the tests the other test
-- stores were added for: it appeared for the Victorian, NSW, UK, US and NZ
-- cases alike.
--
-- Melbourne CBD, so it sits with the real venues and behaves like one.
--
-- The address is left as "1 Test Street" — it is deliberately not a real place,
-- and the postcode column is what the filter reads. Only the region changes.

update public.locations
   set postcode = '3000'
 where id = 'e4b5fa71-5e34-4c22-a571-3130a1bbca2f'   -- Test Venue (Safe)
   and postcode is null;

-- ── Still without a postcode, and deliberately so ───────────────────────────
--
--   Mini Myths          club  — a club has no address of its own, and is
--   ZZ Host Club        club    already restricted to the people attached to
--                               it, so the region filter has nothing to add.
--   The Djerring Center space — never offered in any picker.
--
-- NOT covered here, and worth a decision: ZZ Their Venue is kind = 'venue' with
-- is_test = false and no postcode, so it is publicly visible AND shown to every
-- region, the same way Test Venue (Safe) was. It reads like a test fixture that
-- was never flagged as one. Either marking it is_test or giving it a postcode
-- would settle it; left alone here because reclassifying somebody else's
-- fixture is not this migration's call.
