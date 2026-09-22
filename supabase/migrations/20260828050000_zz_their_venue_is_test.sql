-- ============================================================================
-- Mark ZZ Their Venue as a test venue
-- ============================================================================
--
-- It is a fixture — paired with ZZ Host Club and the draft "ZZ Hosted Event"
-- pack — that was never flagged as one. Left as it was, it is a publicly
-- visible venue with no postcode, which means it shows up for every real user
-- in every region.
--
-- ── WHY THE ADMIN ROW IS PART OF THIS, NOT AN EXTRA ─────────────────────────
--
-- The `locations` read policy grants nothing to platform admins as such. A row
-- with is_test = true is readable ONLY by its own admins, staff, organisers and
-- members — and this venue has an empty `admins` array, no staff and no
-- members. Flipping the flag on its own would produce a row that literally
-- nobody can read, edit or delete through the app, recoverable only by a direct
-- database write. That is the same trap ManageLocations already warns about for
-- an ownerless space.
--
-- So the owner of the fixture goes in `admins` in the same statement. This is
-- not scope creep; without it the change is a one-way door.
--
-- The draft pack attached to it ("ZZ Hosted Event", status = draft, no slug) is
-- owned by the same person and has no public page, so nothing user-facing
-- depends on this venue staying readable.

update public.locations
   set is_test = true,
       admins  = array['c0fab326-f180-4fe6-bf1b-87c069be3794']::uuid[]
 where id = 'ea000000-0000-0000-0000-000000000002'   -- ZZ Their Venue
   and not is_test;

-- ── Left alone ───────────────────────────────────────────────────────────────
--
-- ZZ Host Club is kind = 'club', and the public read branch is limited to
-- `kind = 'venue'` — so it is already invisible to anyone not attached to it,
-- test flag or not. It has a staff row, so it stays reachable.
--
-- ZZ Their Venue still has no postcode, so it derives no region and will keep
-- appearing in every region's list for the people who CAN see it — now just its
-- admin rather than everybody. Give it one if that noise is unwelcome; it was
-- not obvious where a venue called "their venue" is meant to be.
