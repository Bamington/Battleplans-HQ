-- 20260811030000_test_locations_visible_to_staff.sql
--
-- Let staff see the test venue they work at.
--
-- 20260722020000 hid test venues from everyone but their admins, written when
-- an admin was the only way to be attached to a venue. 20260811020000 added a
-- second way — staff — and missed this policy, so a staff member at a test
-- venue could read its BOOKINGS but not the venue row itself. The venue picker
-- had nothing to render, and the store view was unreachable.
--
-- Only test venues were affected: a normal venue passes `not is_test` and is
-- readable by anyone.
--
-- Split by role rather than adding a third OR to the shared policy, because
-- `is_location_staff` is executable by `authenticated` only. Leaving it in a
-- policy that also applies to `anon` would risk a permission error on the
-- anonymous path — the one that serves the public venue pages. Anonymous
-- readers get exactly what they had; the membership check is only ever
-- reached by a signed-in user.
--
-- Idempotent: safe to re-run.

drop policy if exists "Anyone can read non-test locations" on public.locations;
drop policy if exists "Anonymous readers see non-test locations" on public.locations;
drop policy if exists "Signed-in readers see non-test locations and their own" on public.locations;

-- Unchanged in effect: under the old policy `auth.uid() = any(admins)` was
-- always NULL for anon, so this already was the anonymous rule.
create policy "Anonymous readers see non-test locations"
    on public.locations for select
    to anon
    using (not is_test);

-- Strict superset of what signed-in users could see before: the venues you
-- work at now count alongside the venues you administer.
create policy "Signed-in readers see non-test locations and their own"
    on public.locations for select
    to authenticated
    using (
        not is_test
        or auth.uid() = any (admins)
        or public.is_location_staff(id)
    );
