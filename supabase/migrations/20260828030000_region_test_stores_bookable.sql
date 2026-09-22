-- ============================================================================
-- Test Store NSW, and tables + timeslots so all four test stores can be booked
-- ============================================================================
--
-- Adds the fourth test store — the one that exercises filtering WITHIN a
-- country. Every real venue is Victorian, so until now nothing could tell
-- "AU-VIC vs AU-NSW" apart from "AU vs GB"; a Sydney postcode proves the state
-- ranges are actually being used rather than just the country code.
--
-- Then gives all four a couple of tables and a couple of timeslots, because a
-- venue with neither can be chosen in the picker and then goes nowhere.
--
-- ── ON THESE STAYING HIDDEN ─────────────────────────────────────────────────
--
-- Visibility is enforced on `locations`, and only there: the read policy hides
-- an `is_test` row from anonymous readers and from every signed-in user who is
-- not one of its admins, staff, organisers or members. The venue picker reads
-- `locations`, so a regular user never sees these to pick in the first place.
--
-- `store_tables`, `timeslots` and `store_table_timeslots` are all readable by
-- anyone (`using (true)`), so the rows added below are not themselves secret.
-- That is pre-existing and unchanged — Test Venue (Safe) has had tables and
-- timeslots under exactly these policies for a while. What those rows expose is
-- a location_id and a table called "Table 1"; the venue's name, address and
-- email stay behind the `locations` policy. Nothing here widens that.
--
-- The one thing that WOULD undo it is attaching a regular user to a test store
-- — as an admin, staff member, organiser or club member. Don't.
--
-- ── REMOVING IT ALL ─────────────────────────────────────────────────────────
-- Tables, timeslots, bookings and blocked dates all cascade from the location,
-- so deleting the four rows is the whole cleanup:
--   delete from public.locations where id in (
--     '7e570000-0000-4000-a000-000000000001',   -- USA
--     '7e570000-0000-4000-a000-000000000002',   -- England
--     '7e570000-0000-4000-a000-000000000003',   -- New Zealand
--     '7e570000-0000-4000-a000-000000000004');  -- NSW

-- ── The fourth store ─────────────────────────────────────────────────────────
-- Same guards as the other three (see 20260828020000): is_test, an address
-- Chris owns for store_email, and his id in admins so he can see it at all —
-- the read policy has no platform-admin bypass.

insert into public.locations (id, name, address, country, postcode, kind, is_test, store_email, admins)
values
  ('7e570000-0000-4000-a000-000000000004',
   'Test Store NSW', '1 Test Street, Sydney NSW 2000',
   'AU', '2000', 'venue', true, 'chris.bam.harrison@gmail.com',
   array['c0fab326-f180-4fe6-bf1b-87c069be3794']::uuid[])
on conflict (id) do nothing;

-- ── Tables ───────────────────────────────────────────────────────────────────
-- Two each, unlabelled. A null label is the "this venue's tables are all the
-- same" case, which is the shortest path through the booking form — the label
-- picker only appears when there is a choice to make.

insert into public.store_tables (location_id, name, size, enabled, label)
select loc.id, t.name, 'wargaming', true, null
  from (values
    ('7e570000-0000-4000-a000-000000000001'::uuid),
    ('7e570000-0000-4000-a000-000000000002'::uuid),
    ('7e570000-0000-4000-a000-000000000003'::uuid),
    ('7e570000-0000-4000-a000-000000000004'::uuid)
  ) as loc(id)
  cross join (values ('Table 1'), ('Table 2')) as t(name)
 where not exists (
   select 1 from public.store_tables st
    where st.location_id = loc.id and st.name = t.name);

-- ── Timeslots ────────────────────────────────────────────────────────────────
-- Every day of the week so a test booking can be made for whatever date is
-- convenient, rather than only on the days a real shop happens to open.
-- `audience = 'anyone'` keeps them off the members-only path.

insert into public.timeslots (location_id, name, start_time, end_time, availability, audience, interval_weeks)
select loc.id, s.name, s.starts::time, s.ends::time,
       array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
       'anyone', 1
  from (values
    ('7e570000-0000-4000-a000-000000000001'::uuid),
    ('7e570000-0000-4000-a000-000000000002'::uuid),
    ('7e570000-0000-4000-a000-000000000003'::uuid),
    ('7e570000-0000-4000-a000-000000000004'::uuid)
  ) as loc(id)
  cross join (values
    ('Morning', '10:00', '14:00'),
    ('Evening', '18:00', '22:00')
  ) as s(name, starts, ends)
 where not exists (
   select 1 from public.timeslots ts
    where ts.location_id = loc.id and ts.name = s.name);

-- ── Which tables serve which slots ───────────────────────────────────────────
-- Both tables serve both slots. Without these rows the venue has tables and
-- timeslots but no capacity, and the booking form offers a slot it then refuses
-- to fill.

insert into public.store_table_timeslots (table_id, timeslot_id)
select st.id, ts.id
  from public.store_tables st
  join public.timeslots ts on ts.location_id = st.location_id
 where st.location_id in (
   '7e570000-0000-4000-a000-000000000001',
   '7e570000-0000-4000-a000-000000000002',
   '7e570000-0000-4000-a000-000000000003',
   '7e570000-0000-4000-a000-000000000004')
   and not exists (
     select 1 from public.store_table_timeslots x
      where x.table_id = st.id and x.timeslot_id = ts.id);
