-- 20260814030000_clubs.sql
--
-- A club is a group of people, not a place.
--
-- 20260814020000 defined 'club' in the kind constraint but nothing could create
-- one, for a single stubborn reason: `address` is NOT NULL, and a club's whole
-- character is that it does not have one. It borrows a room — a space — or it
-- meets at somebody else's shop.
--
-- Everything else a club needs already exists, which is the point of putting
-- clubs in `locations` rather than beside it. Admins, staff, bookings, tables,
-- stats, blocked dates, BattlePacks and the location_apps switch all key off a
-- location id and work the moment the row does.
--
-- THE NOT NULL IS REPLACED, NOT REMOVED. Dropping it outright would let a venue
-- be saved with no address, which nothing in the product wants and no form
-- currently guards against. The check below keeps the old rule for venues and
-- spaces and makes the exception exactly as wide as a club.
--
-- Idempotent: safe to re-run.

alter table public.locations
  alter column address drop not null;

alter table public.locations
  drop constraint if exists locations_address_required_unless_club;

alter table public.locations
  add constraint locations_address_required_unless_club
  check (kind = 'club' or address is not null);

comment on column public.locations.address is
  'Where it is. Required for a venue and for a space; NULL for a club, which has no address of its own — it meets at a space or at somebody else''s venue.';

comment on column public.locations.kind is
  'venue = a bookable business, listed publicly. club = a group of people, no address of its own, private until it says otherwise. space = a borrowed room; has an address, never public.';

-- ── A note on who can see a club ─────────────────────────────────────────────
--
-- No policy changes here, and that is deliberate rather than an omission.
-- 20260814020000 wrote the public read branch as `not is_test and kind =
-- 'venue'`, so a club is ALREADY invisible to anonymous readers and to signed-in
-- users who have nothing to do with it. Only its admins and its staff can see
-- it.
--
-- That is the right default while a club has no way to say whether it wants to
-- be found. Opening one up is the per-club visibility setting, and it belongs
-- with membership rather than here — a club that can be discovered but has no
-- members and no bookable night is a worse answer than a club that is private.
