-- 20260722020000_test_locations.sql
--
-- Adds a "test store" flag so booking features can be built and exercised
-- against real data paths without a real venue — or a real customer — receiving
-- mail.
--
-- The flag does one thing only: it hides the venue. Notifications need no
-- special handling, because a test store's store_email simply IS a safe address
-- you own. There is deliberately no second "test email" column — one field that
-- always holds the true destination can't drift out of step with a shadow copy
-- of itself, and "where does this store's mail go?" has exactly one answer.
--
-- Two properties fall out of this without extra code:
--
--   * A half-configured test store sends nothing. send-booking-notification
--     already skips a venue with no store_email, so the safe default is the
--     one you get by not having finished setup.
--
--   * No real customer can book a test store, because they can't see it — which
--     is what keeps any customer-facing mail added later safe too.
--
-- The hazard this does NOT protect against is flipping an existing live store
-- to is_test and leaving the real address in store_email. That's a UI problem,
-- and Manage Locations warns about it at the point the flag is set.

alter table public.locations
  add column if not exists is_test boolean not null default false;

comment on column public.locations.is_test is
  'Test venue: hidden from everyone but admins. Its store_email should be an address you own.';

-- Test venues are rare, so index only those rows.
create index if not exists locations_is_test_idx
  on public.locations (is_test) where is_test;

-- ── Visibility ────────────────────────────────────────────────────────────────
-- Replaces the blanket "Anyone can read locations" policy. Everything readable
-- before is still readable; only test venues are carved out.
--
-- Policies are OR'd, so platform admins keep full visibility through the
-- existing "Admins can manage locations" policy. Venue admins are named here
-- explicitly so whoever is assigned to a test venue can actually use it.

drop policy if exists "Anyone can read locations" on public.locations;

create policy "Anyone can read non-test locations"
  on public.locations for select
  to authenticated, anon
  using (
    not is_test
    or auth.uid() = any (admins)
  );
