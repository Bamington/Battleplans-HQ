-- burrow_games.sql — Marketing screenshot fixture
--
-- Creates "Burrow Games", a TEST venue whose bookings exist purely so the
-- marketing pages can be screenshotted against believable data instead of real
-- customers. Nothing here is a schema change, so it deliberately does not live
-- in supabase/migrations — run it by hand when the fixture needs rebuilding.
--
-- Why a test venue rather than a scratch database: the whole point is to
-- screenshot the real app, on the real schema, with the real queries. is_test
-- hides the venue from everyone but its admins (20260722020000_test_locations),
-- so no player can see or book it, and store_email is an address we own.
--
-- SAFETY — READ BEFORE RUNNING
--
--   The bookings table has an AFTER INSERT trigger that emails the venue for
--   any booking dated today or later, and an AFTER DELETE trigger that does the
--   same for cancellations. Roughly twenty of the rows below are future-dated,
--   and re-running the script deletes the previous set first — so without the
--   guards this would send about forty emails per run.
--
--   Both triggers are disabled around the data changes and re-enabled at the
--   end, exactly as 20260720010000_booking_notification_trigger.sql advises for
--   bulk loads. Do not remove the disable/enable pair, and do not rely on the
--   trigger's own past-date guard — it protects history, not the future.
--
-- IDEMPOTENT: every id is fixed, and the script clears this location's rows
-- before reinserting. The deletes are scoped by location_id to the fixture's
-- own uuid and can't reach another venue's data.

begin;

alter table public.bookings disable trigger bookings_notify_created;
alter table public.bookings disable trigger bookings_notify_cancelled;

-- ── The venue ───────────────────────────────────────────────────────────────
-- admins is the platform owner, so the venue is reachable in the app for
-- screenshots. store_email is a real address we own, per the test-venue rule.

insert into public.locations (id, name, address, store_email, is_test, admins)
values (
  'b0770000-0000-4000-a000-000000000001',
  'Burrow Games',
  '14 Warren Street, Fitzroy VIC 3065',
  'chris.bam.harrison@gmail.com',
  true,
  array['c0fab326-f180-4fe6-bf1b-87c069be3794'::uuid]
)
on conflict (id) do update
  set name        = excluded.name,
      address     = excluded.address,
      store_email = excluded.store_email,
      is_test     = excluded.is_test,
      admins      = excluded.admins;

-- Clear this venue's rows so the script can be re-run. Timeslots and tables
-- cascade from locations, but the venue row survives the upsert above, so they
-- are cleared explicitly. Bookings first — they reference timeslots.
delete from public.bookings    where location_id = 'b0770000-0000-4000-a000-000000000001';
delete from public.store_tables where location_id = 'b0770000-0000-4000-a000-000000000001';
delete from public.timeslots    where location_id = 'b0770000-0000-4000-a000-000000000001';

-- ── Timeslots ───────────────────────────────────────────────────────────────
-- Same three-slot shape the real venues use. Evenings run Wednesday to Friday
-- only, which is what makes "busiest timeslot" a real finding rather than an
-- artefact of every slot being open every day.

insert into public.timeslots (id, location_id, name, start_time, end_time, availability) values
  ('b0770000-0000-4000-a000-000000000011', 'b0770000-0000-4000-a000-000000000001', 'Morning',   '10:30', '15:00',
   array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),
  ('b0770000-0000-4000-a000-000000000012', 'b0770000-0000-4000-a000-000000000001', 'Afternoon', '15:00', '18:00',
   array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),
  ('b0770000-0000-4000-a000-000000000013', 'b0770000-0000-4000-a000-000000000001', 'Evening',   '18:00', '22:00',
   array['Wednesday','Thursday','Friday']);

-- ── Tables ──────────────────────────────────────────────────────────────────
-- Six wargaming tables and two TCG, which is a plausible independent shop and
-- gives the Manage Store screenshot enough rows to look lived-in.

insert into public.store_tables (id, location_id, name, size, enabled) values
  ('b0770000-0000-4000-a000-000000000021', 'b0770000-0000-4000-a000-000000000001', 'Table 1', 'wargaming', true),
  ('b0770000-0000-4000-a000-000000000022', 'b0770000-0000-4000-a000-000000000001', 'Table 2', 'wargaming', true),
  ('b0770000-0000-4000-a000-000000000023', 'b0770000-0000-4000-a000-000000000001', 'Table 3', 'wargaming', true),
  ('b0770000-0000-4000-a000-000000000024', 'b0770000-0000-4000-a000-000000000001', 'Table 4', 'wargaming', true),
  ('b0770000-0000-4000-a000-000000000025', 'b0770000-0000-4000-a000-000000000001', 'Table 5', 'wargaming', true),
  ('b0770000-0000-4000-a000-000000000026', 'b0770000-0000-4000-a000-000000000001', 'Table 6', 'wargaming', false),
  ('b0770000-0000-4000-a000-000000000027', 'b0770000-0000-4000-a000-000000000001', 'TCG 1',   'tcg',       true),
  ('b0770000-0000-4000-a000-000000000028', 'b0770000-0000-4000-a000-000000000001', 'TCG 2',   'tcg',       true);

-- Which tables are bookable in which slot. Without these rows Manage Store
-- reports "Available for 0 of 3 timeslots" on every table while bookings sit in
-- all three — a fixture that contradicts itself on screen.
--
-- The wargaming tables are open in every slot. The two TCG tables skip Morning,
-- which is the sort of small asymmetry a real shop has and a generated fixture
-- usually lacks.
insert into public.store_table_timeslots (table_id, timeslot_id)
select t.id, ts.id
from public.store_tables t
join public.timeslots ts on ts.location_id = t.location_id
where t.location_id = 'b0770000-0000-4000-a000-000000000001'
  and not (t.size = 'tcg' and ts.name = 'Morning')
on conflict do nothing;

-- ── The bookers ─────────────────────────────────────────────────────────────
--
-- bookings.user_id references auth.users, so invented bookers need real auth
-- rows. Ten of them, so Store Stats has distinct booking accounts to rank —
-- it groups by account, not by the free-text name on the booking, so ten names
-- against one account would collapse into a single booker.
--
-- These are deliberately inert:
--
--   * encrypted_password is left null, so no password can ever authenticate.
--   * Addresses are @burrow.test. RFC 2606 reserves .test and it resolves
--     nowhere, so a magic link can't be delivered even if someone tried.
--   * They never log in, so no session, no RLS reach, nothing they can see.
--
-- They WILL appear in the admin Manage Users screen. There is no is_test flag
-- for users the way there is for venues, and inventing one for a screenshot
-- fixture would be a schema change for a cosmetic problem — the @burrow.test
-- domain is what marks them.
--
-- Inserting here fires handle_new_user(), which derives a handle from the email
-- local part and creates the user_profiles row. The display names are set after,
-- since that trigger only sets the handle.

insert into auth.users (id, aud, role, email, created_at, updated_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
select
  b.id,
  'authenticated',
  'authenticated',
  b.email,
  timestamptz '2026-01-05 09:00+11',
  timestamptz '2026-01-05 09:00+11',
  timestamptz '2026-01-05 09:00+11',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', b.name)
from (values
  ('b0770000-0000-4000-b000-000000000001'::uuid, 'marcus.webb@burrow.test',   'Marcus Webb'),
  ('b0770000-0000-4000-b000-000000000002'::uuid, 'priya.nair@burrow.test',    'Priya Nair'),
  ('b0770000-0000-4000-b000-000000000003'::uuid, 'tom.ashworth@burrow.test',  'Tom Ashworth'),
  ('b0770000-0000-4000-b000-000000000004'::uuid, 'sofia.reyes@burrow.test',   'Sofia Reyes'),
  ('b0770000-0000-4000-b000-000000000005'::uuid, 'daniel.okafor@burrow.test', 'Daniel Okafor'),
  ('b0770000-0000-4000-b000-000000000006'::uuid, 'ellie.zhang@burrow.test',   'Ellie Zhang'),
  ('b0770000-0000-4000-b000-000000000007'::uuid, 'josh.brennan@burrow.test',  'Josh Brennan'),
  ('b0770000-0000-4000-b000-000000000008'::uuid, 'amara.diallo@burrow.test',  'Amara Diallo'),
  ('b0770000-0000-4000-b000-000000000009'::uuid, 'rob.sinclair@burrow.test',  'Rob Sinclair'),
  ('b0770000-0000-4000-b000-00000000000a'::uuid, 'hannah.foster@burrow.test', 'Hannah Foster')
) as b(id, email, name)
on conflict (id) do nothing;

-- Display names, and mark them onboarded so nothing treats them as half-set-up.
update public.user_profiles p
set username  = u.raw_user_meta_data->>'display_name',
    onboarded = true
from auth.users u
where u.id = p.id and u.email like '%@burrow.test';

insert into public.profiles (id, display_name)
select u.id, u.raw_user_meta_data->>'display_name'
from auth.users u
where u.email like '%@burrow.test'
on conflict (id) do update set display_name = excluded.display_name;

-- ── Bookings ────────────────────────────────────────────────────────────────
--
-- Fifty bookings across 2026, roughly thirty behind today and twenty ahead.
--
-- user_email is left null, matching how real rows in this table actually look.
--
-- The distribution is designed, not random, because these numbers end up in the
-- Store Stats screenshot and that screenshot needs to tell a story a shop owner
-- recognises:
--
--   * A fortnightly Thursday club night, heavy on 40K — the busiest day and
--     the busiest timeslot.
--   * Monthly Saturday afternoons, broader mix of games, different crowd.
--   * Occasional Sunday mornings and Wednesday evenings.
--   * Marcus Webb turns up far more than anyone else, so "most frequent
--     bookers" has an obvious top.
--
-- Arrays are indexed by the series number modulo their length, so the mix
-- repeats on a cycle that doesn't line up between bookers and games.

with
-- Numbered explicitly rather than by row_number(), which has no guaranteed
-- order over a VALUES list and would silently reshuffle who books what.
booker(n, id, name) as (values
  (1,  'b0770000-0000-4000-b000-000000000001'::uuid, 'Marcus Webb'),
  (2,  'b0770000-0000-4000-b000-000000000002'::uuid, 'Priya Nair'),
  (3,  'b0770000-0000-4000-b000-000000000003'::uuid, 'Tom Ashworth'),
  (4,  'b0770000-0000-4000-b000-000000000004'::uuid, 'Sofia Reyes'),
  (5,  'b0770000-0000-4000-b000-000000000005'::uuid, 'Daniel Okafor'),
  (6,  'b0770000-0000-4000-b000-000000000006'::uuid, 'Ellie Zhang'),
  (7,  'b0770000-0000-4000-b000-000000000007'::uuid, 'Josh Brennan'),
  (8,  'b0770000-0000-4000-b000-000000000008'::uuid, 'Amara Diallo'),
  (9,  'b0770000-0000-4000-b000-000000000009'::uuid, 'Rob Sinclair'),
  (10, 'b0770000-0000-4000-b000-00000000000a'::uuid, 'Hannah Foster')
),
game(key, id) as (values
  ('40k',        '05009dfc-a129-4d86-9b25-680feb690746'::uuid),
  ('aos',        '3a1cc6ec-a1ec-4139-abb1-b0c6f29bb04d'::uuid),
  ('bloodbowl',  '1a19e961-8273-46aa-9a74-f0ebd90657c5'::uuid),
  ('battletech', 'aa727d43-324f-4f5c-9aa6-ebe5810e0abe'::uuid),
  ('boltaction', '07a6af65-00cc-469e-ade4-3a9ab973e1ef'::uuid),
  ('necromunda', 'c8bd38d8-bbcf-44a0-8994-398feb11f2cd'::uuid),
  ('mcp',        'a01e71b7-ce00-498c-bda2-7dce8b03d580'::uuid),
  ('warmachine', '2258f2fb-3089-4051-b1eb-c317ec4a3450'::uuid),
  ('infinity',   '8bdd2d21-1b81-4196-a1ca-f6ad93a9694a'::uuid),
  ('flames',     '509c7772-b964-410d-91d4-70a23959156b'::uuid)
),
-- Each pattern: its dates, its timeslot, and the cycles it draws from.
pattern(slot_id, slot_name, starts, ends, day0, step, n_dates, bookers, games) as (values
  -- Thursday club night, fortnightly. 25 dates.
  ('b0770000-0000-4000-a000-000000000013'::uuid, 'Evening', '18:00:00', '22:00:00',
   date '2026-01-08', 14, 25,
   array[1,2,3,1,4,1,5,2,3,1],
   array['40k','40k','aos','40k','necromunda','40k','aos','boltaction']),
  -- Saturday afternoons, every four weeks. 13 dates.
  ('b0770000-0000-4000-a000-000000000012'::uuid, 'Afternoon', '15:00:00', '18:00:00',
   date '2026-01-10', 28, 13,
   array[6,7,4,8,6,9,10],
   array['aos','bloodbowl','mcp','40k','battletech','aos','bloodbowl']),
  -- Sunday mornings, every eight weeks. 7 dates.
  ('b0770000-0000-4000-a000-000000000011'::uuid, 'Morning', '10:30:00', '15:00:00',
   date '2026-01-18', 56, 7,
   array[9,10,5,8,9],
   array['battletech','boltaction','flames','infinity','warmachine']),
  -- The odd Wednesday evening. 5 dates.
  ('b0770000-0000-4000-a000-000000000013'::uuid, 'Evening', '18:00:00', '22:00:00',
   date '2026-02-04', 70, 5,
   array[3,7,1,6,5],
   array['necromunda','bloodbowl','40k','warmachine','infinity'])
),
scheduled as (
  select
    p.slot_id,
    p.slot_name,
    p.starts,
    p.ends,
    p.day0 + (s.n * p.step) as day,
    p.bookers[(s.n % array_length(p.bookers, 1)) + 1] as booker_n,
    p.games  [(s.n % array_length(p.games,   1)) + 1] as game_key
  from pattern p,
       lateral generate_series(0, p.n_dates - 1) as s(n)
)
insert into public.bookings (
  id, location_id, timeslot_id, game_id, date, user_id, user_name, user_email,
  location_name, timeslot_name, timeslot_start_time, timeslot_end_time
)
select
  gen_random_uuid(),
  'b0770000-0000-4000-a000-000000000001',
  s.slot_id,
  g.id,
  s.day,
  b.id,
  b.name,
  null,
  'Burrow Games',
  s.slot_name,
  s.starts,
  s.ends
from scheduled s
join game   g on g.key = s.game_key
join booker b on b.n  = s.booker_n;

-- ── The next three days ─────────────────────────────────────────────────────
--
-- The fortnightly pattern above almost never lands on the day you happen to be
-- taking screenshots, and "Today's Bookings" is an empty column in every shot
-- of the venue side unless something is booked right now. So: today, tomorrow
-- and the day after, whenever this is run.
--
-- Anchored to current_date rather than fixed dates, because a fixture that has
-- to be edited before every screenshot session will eventually be screenshotted
-- stale.
--
-- Slots are chosen from each day's real availability rather than assumed.
-- Evenings only run Wednesday to Friday here, so hardcoding an evening booking
-- would put a row in the table that the app itself would have refused to make —
-- and the whole point of shooting the real app is that nothing on screen is
-- something it couldn't have produced.

with
-- Numbered 1..8 for this block only, so the modulo below indexes it directly.
booker(n, id, name) as (values
  (1, 'b0770000-0000-4000-b000-000000000001'::uuid, 'Marcus Webb'),
  (2, 'b0770000-0000-4000-b000-000000000002'::uuid, 'Priya Nair'),
  (3, 'b0770000-0000-4000-b000-000000000003'::uuid, 'Tom Ashworth'),
  (4, 'b0770000-0000-4000-b000-000000000004'::uuid, 'Sofia Reyes'),
  (5, 'b0770000-0000-4000-b000-000000000006'::uuid, 'Ellie Zhang'),
  (6, 'b0770000-0000-4000-b000-000000000007'::uuid, 'Josh Brennan'),
  (7, 'b0770000-0000-4000-b000-000000000008'::uuid, 'Amara Diallo'),
  (8, 'b0770000-0000-4000-b000-000000000009'::uuid, 'Rob Sinclair')
),
game(n, id) as (values
  (1, '05009dfc-a129-4d86-9b25-680feb690746'::uuid),  -- Warhammer 40,000
  (2, '3a1cc6ec-a1ec-4139-abb1-b0c6f29bb04d'::uuid),  -- Age of Sigmar
  (3, '1a19e961-8273-46aa-9a74-f0ebd90657c5'::uuid),  -- Blood Bowl
  (4, 'c8bd38d8-bbcf-44a0-8994-398feb11f2cd'::uuid),  -- Necromunda
  (5, 'aa727d43-324f-4f5c-9aa6-ebe5810e0abe'::uuid),  -- Battletech
  (6, 'a01e71b7-ce00-498c-bda2-7dce8b03d580'::uuid)   -- Marvel Crisis Protocol
),
-- Every slot genuinely open on each of the three days.
open_slot as (
  select
    d.day,
    ts.id as slot_id,
    ts.name as slot_name,
    to_char(ts.start_time, 'HH24:MI:SS') as starts,
    to_char(ts.end_time,   'HH24:MI:SS') as ends,
    row_number() over (order by d.day, ts.start_time) as seq
  from generate_series(0, 2) as g(offset_days)
  cross join lateral (select current_date + g.offset_days as day) d
  join public.timeslots ts
    on ts.location_id = 'b0770000-0000-4000-a000-000000000001'
   and trim(to_char(d.day, 'Day')) = any (ts.availability)
),
-- One booking per open slot, plus a second on the busiest slot of each day, so
-- the column has enough rows to look like a real day rather than a demo.
row_to_make as (
  select day, slot_id, slot_name, starts, ends, seq, 0 as dup from open_slot
  union all
  select day, slot_id, slot_name, starts, ends, seq, 1 from open_slot
  where slot_name in ('Afternoon', 'Evening')
)
insert into public.bookings (
  id, location_id, timeslot_id, game_id, date, user_id, user_name, user_email,
  location_name, timeslot_name, timeslot_start_time, timeslot_end_time
)
select
  gen_random_uuid(),
  'b0770000-0000-4000-a000-000000000001',
  r.slot_id,
  gm.id,
  r.day,
  b.id,
  b.name,
  null,
  'Burrow Games',
  r.slot_name,
  r.starts,
  r.ends
from row_to_make r
join booker b  on b.n  = ((r.seq * 2 + r.dup) % 8) + 1
join game   gm on gm.n = ((r.seq + r.dup * 3) % 6) + 1;

alter table public.bookings enable trigger bookings_notify_created;
alter table public.bookings enable trigger bookings_notify_cancelled;

commit;
