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

insert into auth.users (
  id, instance_id, aud, role, email, created_at, updated_at, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  b.id,
  -- GoTrue's own inserts use the zero uuid here, and it filters on it.
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  b.email,
  timestamptz '2026-01-05 09:00+11',
  timestamptz '2026-01-05 09:00+11',
  timestamptz '2026-01-05 09:00+11',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', b.name),
  /*
   * Empty strings, NOT null.
   *
   * GoTrue scans these four into non-nullable Go strings, so a null makes
   * sign-in fail with a type error before it ever gets as far as checking the
   * password — which looks exactly like a wrong password from the outside.
   * A real signup writes '' here; only hand-written SQL leaves them null.
   */
  '', '', '', ''
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

/*
 * Repair rows created before the columns above were part of the insert.
 *
 * The insert is `on conflict do nothing`, so it can't correct an existing row —
 * and these accounts are meant to outlive rebuilds, since a password set by
 * hand lives on them. Hence a separate, idempotent normalise.
 *
 * encrypted_password is deliberately untouched: setting a password on one of
 * these is a manual step done outside this script, and a rebuild must not
 * undo it.
 */
update auth.users
set instance_id             = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
    confirmation_token      = coalesce(confirmation_token, ''),
    recovery_token          = coalesce(recovery_token, ''),
    email_change            = coalesce(email_change, ''),
    email_change_token_new  = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change            = coalesce(phone_change, ''),
    phone_change_token      = coalesce(phone_change_token, ''),
    reauthentication_token  = coalesce(reauthentication_token, '')
where email like '%@burrow.test'
  and (instance_id is null
       or confirmation_token is null
       or recovery_token is null
       or email_change is null
       or email_change_token_new is null);

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

-- ── Blocked dates ───────────────────────────────────────────────────────────
--
-- Relative to today because the table has a CHECK (date >= CURRENT_DATE): fixed
-- dates would seed fine once and then refuse to reinsert the moment they went
-- past, which would break every rebuild from that day on.
--
-- One whole-venue closure, one partial. blocked_tables null means the whole
-- venue; a number blocks that many, which is the more interesting of the two to
-- have on screen.

delete from public.blocked_dates where location_id = 'b0770000-0000-4000-a000-000000000001';

insert into public.blocked_dates (id, location_id, date, description, blocked_tables) values
  ('b0770000-0000-4000-a000-000000000031', 'b0770000-0000-4000-a000-000000000001',
   current_date + 12, 'Closed — Grand Tournament', null),
  ('b0770000-0000-4000-a000-000000000032', 'b0770000-0000-4000-a000-000000000001',
   -- 23 rather than a round number: 5, 12 and 26 days from a Monday all land on
   -- a Saturday, and three identical weekdays in the panel looks generated.
   current_date + 23, 'Stocktake', null),
  ('b0770000-0000-4000-a000-000000000033', 'b0770000-0000-4000-a000-000000000001',
   current_date + 5,  'Painting workshop — 3 tables in use', 3);

-- ── Marcus Webb's battle history ────────────────────────────────────────────
--
-- So the player-facing screens can be screenshotted without a real person's
-- name, or their win rate, ending up on a public marketing page. Marcus already
-- books more than anyone else here, so he's the natural account to build out.
--
-- The record is designed backwards from what the marketing page claims. The
-- landing page promises "find out who your nemesis is", so there has to be a
-- nemesis: Marcus has never beaten Tom Ashworth in eight attempts. It promises
-- best and worst, so Hannah Foster is a clean five from five the other way. The
-- overall record lands at 21-19-2, close enough to even that the nemesis is the
-- thing that stands out rather than the total.
--
-- The three most recent battles are wins, so the Win Streak card reads 3.
--
-- Dates run backwards from today at five-day intervals, which keeps every
-- battle in the past, spreads them across about seven months, and — like the
-- near-term bookings — survives being rebuilt on a different day.
--
-- Deliberately NOT aligned to Marcus's booking dates: bookings without a battle
-- logged against them are exactly what feeds the Suggested Battles column, and
-- that column is a section on the landing page.

delete from public.battles where user_id = 'b0770000-0000-4000-b000-000000000001';
delete from public.opponents where user_id = 'b0770000-0000-4000-b000-000000000001';

-- Opponents are objects rather than free text, and linked_user_id ties each one
-- to the invented account it represents — the same shape a real user gets when
-- they pick an opponent who is also on the platform.
insert into public.opponents (id, user_id, name, linked_user_id) values
  ('b0770000-0000-4000-c000-000000000002', 'b0770000-0000-4000-b000-000000000001', 'Priya Nair',    'b0770000-0000-4000-b000-000000000002'),
  ('b0770000-0000-4000-c000-000000000003', 'b0770000-0000-4000-b000-000000000001', 'Tom Ashworth',  'b0770000-0000-4000-b000-000000000003'),
  ('b0770000-0000-4000-c000-000000000004', 'b0770000-0000-4000-b000-000000000001', 'Sofia Reyes',   'b0770000-0000-4000-b000-000000000004'),
  ('b0770000-0000-4000-c000-000000000005', 'b0770000-0000-4000-b000-000000000001', 'Daniel Okafor', 'b0770000-0000-4000-b000-000000000005'),
  ('b0770000-0000-4000-c000-000000000006', 'b0770000-0000-4000-b000-000000000001', 'Ellie Zhang',   'b0770000-0000-4000-b000-000000000006'),
  ('b0770000-0000-4000-c000-000000000007', 'b0770000-0000-4000-b000-000000000001', 'Josh Brennan',  'b0770000-0000-4000-b000-000000000007'),
  ('b0770000-0000-4000-c000-000000000008', 'b0770000-0000-4000-b000-000000000001', 'Amara Diallo',  'b0770000-0000-4000-b000-000000000008'),
  ('b0770000-0000-4000-c000-000000000009', 'b0770000-0000-4000-b000-000000000001', 'Rob Sinclair',  'b0770000-0000-4000-b000-000000000009'),
  ('b0770000-0000-4000-c000-00000000000a', 'b0770000-0000-4000-b000-000000000001', 'Hannah Foster', 'b0770000-0000-4000-b000-00000000000a');

with
game(key, id) as (values
  ('40k',          '05009dfc-a129-4d86-9b25-680feb690746'::uuid),
  ('aos',          '3a1cc6ec-a1ec-4139-abb1-b0c6f29bb04d'::uuid),
  ('necromunda',   'c8bd38d8-bbcf-44a0-8994-398feb11f2cd'::uuid),
  ('bloodbowl',    '1a19e961-8273-46aa-9a74-f0ebd90657c5'::uuid),
  ('battletech',   'aa727d43-324f-4f5c-9aa6-ebe5810e0abe'::uuid),
  ('shatterpoint', '44e458ea-51b2-4e56-9148-10ed10355eda'::uuid),
  ('halo',         '9ec0a79d-f780-4031-86bb-030fa669355e'::uuid)
),
/*
 * n counts backwards from today: 0 is the most recent battle.
 *
 * The fourteen most recent are Shatterpoint, Blood Bowl and Halo — the three
 * games there are real photographs for. The battle grid is ordered newest
 * first, so this is what puts pictures on the cards that are actually in frame;
 * everything older keeps the wargaming mix and renders as plain cards, which is
 * what a real account looks like anyway.
 *
 * Only the GAME changed on these rows. Opponents and results are untouched, so
 * the record still lands at 21-19-2 with Tom Ashworth as the nemesis and Hannah
 * Foster five from five. 40K also stays the most played game overall at 12,
 * which keeps it consistent with the venue's booking data.
 */
spec(n, game_key, opp_name, result) as (values
  ( 0, 'shatterpoint', 'Hannah Foster', 'won'),
  ( 1, 'bloodbowl',    'Priya Nair',    'won'),
  ( 2, 'shatterpoint', 'Josh Brennan',  'won'),
  ( 3, 'shatterpoint', 'Tom Ashworth',  'lost'),
  ( 4, 'halo',         'Ellie Zhang',   'lost'),
  ( 5, 'shatterpoint', 'Sofia Reyes',   'won'),
  ( 6, 'bloodbowl',    'Hannah Foster', 'won'),
  ( 7, 'shatterpoint', 'Tom Ashworth',  'lost'),
  ( 8, 'bloodbowl',    'Rob Sinclair',  'drew'),
  ( 9, 'shatterpoint', 'Daniel Okafor', 'won'),
  (10, 'halo',         'Priya Nair',    'won'),
  (11, 'shatterpoint', 'Tom Ashworth',  'lost'),
  (12, 'bloodbowl',    'Amara Diallo',  'won'),
  (13, 'shatterpoint', 'Ellie Zhang',   'lost'),
  (14, 'necromunda', 'Josh Brennan',  'won'),
  (15, 'aos',        'Hannah Foster', 'won'),
  (16, '40k',        'Tom Ashworth',  'drew'),
  (17, '40k',        'Sofia Reyes',   'won'),
  (18, 'bloodbowl',  'Priya Nair',    'lost'),
  (19, 'aos',        'Daniel Okafor', 'lost'),
  (20, '40k',        'Tom Ashworth',  'lost'),
  (21, 'necromunda', 'Ellie Zhang',   'lost'),
  (22, '40k',        'Hannah Foster', 'won'),
  (23, 'aos',        'Josh Brennan',  'won'),
  (24, '40k',        'Rob Sinclair',  'won'),
  (25, 'battletech', 'Amara Diallo',  'won'),
  (26, '40k',        'Tom Ashworth',  'lost'),
  (27, 'aos',        'Sofia Reyes',   'won'),
  (28, 'necromunda', 'Priya Nair',    'won'),
  (29, '40k',        'Daniel Okafor', 'lost'),
  (30, 'bloodbowl',  'Ellie Zhang',   'won'),
  (31, '40k',        'Tom Ashworth',  'lost'),
  (32, 'aos',        'Hannah Foster', 'won'),
  (33, '40k',        'Josh Brennan',  'lost'),
  (34, 'battletech', 'Rob Sinclair',  'lost'),
  (35, 'necromunda', 'Sofia Reyes',   'lost'),
  (36, '40k',        'Priya Nair',    'won'),
  (37, 'aos',        'Amara Diallo',  'lost'),
  (38, '40k',        'Tom Ashworth',  'lost'),
  (39, 'bloodbowl',  'Daniel Okafor', 'won'),
  (40, '40k',        'Sofia Reyes',   'lost'),
  (41, 'battletech', 'Priya Nair',    'lost')
),
inserted as (
  insert into public.battles
    (user_id, game_id, date_played, opp_name, result, winner, location_id, location_name)
  select
    'b0770000-0000-4000-b000-000000000001',
    g.id,
    current_date - (s.n * 5),
    s.opp_name,
    s.result,
    -- winner is only permitted on a loss (battles_winner_only_on_loss), and in
    -- a two-player game the winner of a loss is the opponent.
    case when s.result = 'lost' then s.opp_name end,
    'b0770000-0000-4000-a000-000000000001',
    'Burrow Games'
  from spec s
  join game g on g.key = s.game_key
  returning id, opp_name
)
insert into public.battle_opponents (battle_id, opponent_id)
select i.id, o.id
from inserted i
join public.opponents o
  on o.user_id = 'b0770000-0000-4000-b000-000000000001'
 and o.name = i.opp_name;

-- ── Battle photos ───────────────────────────────────────────────────────────
--
-- Attaches the photos that tools/screenshots/copy-battle-photos.mjs has already
-- copied into Marcus's own storage folder. RUN THAT FIRST — this only writes
-- the rows; without the files the cards render as broken images.
--
-- They're copies rather than references because battle_images has
-- UNIQUE (image_path): every original is already claimed by the battle it was
-- uploaded for, so pointing at one fails outright. The copies keep the original
-- filename and swap the owner folder, which is the same rule the copy script
-- uses — that's how the two agree without sharing any state.
--
-- Only the platform owner's own photos are in play. Two images in that bucket
-- belong to other real users and are excluded by the user_id filter; their
-- miniatures are not ours to put on a public marketing page.
--
-- No photo is used twice. A repeated image in a grid is the most obvious
-- possible tell, so coverage is capped by what actually exists: 24 Shatterpoint,
-- 12 Blood Bowl, 2 Halo. Spread three-per-battle that's the fourteen most recent
-- battles — and since the grid is ordered newest first, that's precisely the
-- part of it that ends up in frame. Older battles keep plain cards, which is
-- what a real account looks like anyway.
--
-- Three per battle on the two games that can afford it also gives the
-- multi-photo carousel something to demonstrate.

with
plan(game_name, per_battle, max_battles) as (values
  ('Star Wars Shatterpoint', 3, 8),
  ('Blood Bowl',             3, 4),
  ('Halo: Flashpoint',       1, 2)
),
-- The owner's own photos, oldest first, numbered within each game.
src as (
  select
    'b0770000-0000-4000-b000-000000000001/' || split_part(bi.image_path, '/', 2) as image_path,
    g.name as game_name,
    row_number() over (partition by g.name order by bi.created_at, bi.id) as rn
  from public.battle_images bi
  join public.battles b on b.id = bi.battle_id
  join public.games   g on g.id = b.game_id
  where bi.user_id = 'c0fab326-f180-4fe6-bf1b-87c069be3794'
    and g.name in ('Star Wars Shatterpoint', 'Blood Bowl', 'Halo: Flashpoint')
),
-- Marcus's battles in those games, most recent first.
target as (
  select
    b.id as battle_id,
    g.name as game_name,
    row_number() over (partition by g.name order by b.date_played desc, b.id desc) as rn
  from public.battles b
  join public.games g on g.id = b.game_id
  where b.user_id = 'b0770000-0000-4000-b000-000000000001'
    and g.name in ('Star Wars Shatterpoint', 'Blood Bowl', 'Halo: Flashpoint')
)
insert into public.battle_images (battle_id, user_id, image_path, is_primary, display_order)
select
  t.battle_id,
  'b0770000-0000-4000-b000-000000000001',
  s.image_path,
  s.rn - (t.rn - 1) * p.per_battle = 1,   -- first photo of a battle is its card background
  s.rn - (t.rn - 1) * p.per_battle - 1    -- 0-based order within the battle
from target t
join plan p on p.game_name = t.game_name and t.rn <= p.max_battles
join src  s on s.game_name = t.game_name
           and s.rn between (t.rn - 1) * p.per_battle + 1 and t.rn * p.per_battle;

-- ── Friendships ─────────────────────────────────────────────────────────────
--
-- Without these, My Friends renders "No friends yet" — an empty column in the
-- middle of the player home screen, which is the shot the landing page hero
-- uses. The landing page also sells friends as a feature, so an empty column
-- there is the worst possible thing to photograph.
--
-- Marcus is friends with six of the regulars. Not all nine, deliberately: a
-- player who is friends with literally everyone they have ever played looks
-- generated, and leaving three off means the friends list and the opponents
-- list don't match, which is what real accounts look like.
--
-- Two pending rows as well, one in each direction, so the requests state has
-- something in it — an incoming request from Josh Brennan for Marcus to accept,
-- and an outgoing one to Amara Diallo he's still waiting on.
--
-- Scoped delete: only rows where both sides are invented accounts, so this can
-- never touch a real person's friendships.

delete from public.friendships f
where exists (select 1 from auth.users u where u.id = f.requester_id and u.email like '%@burrow.test')
   or exists (select 1 from auth.users u where u.id = f.addressee_id and u.email like '%@burrow.test');

insert into public.friendships (requester_id, addressee_id, status, created_at, responded_at)
values
  -- Accepted. Mixed direction, because who sent the request is not something
  -- a real friends list has any pattern to.
  ('b0770000-0000-4000-b000-000000000001', 'b0770000-0000-4000-b000-000000000002', 'accepted', timestamptz '2026-02-11 20:15+11', timestamptz '2026-02-11 21:02+11'),
  ('b0770000-0000-4000-b000-000000000003', 'b0770000-0000-4000-b000-000000000001', 'accepted', timestamptz '2026-02-19 19:40+11', timestamptz '2026-02-20 08:11+11'),
  ('b0770000-0000-4000-b000-000000000001', 'b0770000-0000-4000-b000-000000000004', 'accepted', timestamptz '2026-03-05 18:25+11', timestamptz '2026-03-05 19:47+11'),
  ('b0770000-0000-4000-b000-000000000006', 'b0770000-0000-4000-b000-000000000001', 'accepted', timestamptz '2026-04-02 21:10+11', timestamptz '2026-04-03 07:55+11'),
  ('b0770000-0000-4000-b000-000000000001', 'b0770000-0000-4000-b000-000000000009', 'accepted', timestamptz '2026-05-14 20:05+10', timestamptz '2026-05-14 20:31+10'),
  ('b0770000-0000-4000-b000-00000000000a', 'b0770000-0000-4000-b000-000000000001', 'accepted', timestamptz '2026-06-18 19:15+10', timestamptz '2026-06-18 22:40+10'),

  -- Pending, one each way.
  ('b0770000-0000-4000-b000-000000000007', 'b0770000-0000-4000-b000-000000000001', 'pending', timestamptz '2026-07-29 20:50+10', null),
  ('b0770000-0000-4000-b000-000000000001', 'b0770000-0000-4000-b000-000000000008', 'pending', timestamptz '2026-08-01 18:05+10', null),

  -- A few between the others, so the group isn't a star with Marcus at the
  -- centre. Nobody screenshots these, but they cost nothing and mean any other
  -- invented account is usable for a shot later without redoing this.
  ('b0770000-0000-4000-b000-000000000002', 'b0770000-0000-4000-b000-000000000004', 'accepted', timestamptz '2026-03-12 19:00+11', timestamptz '2026-03-12 19:22+11'),
  ('b0770000-0000-4000-b000-000000000003', 'b0770000-0000-4000-b000-000000000006', 'accepted', timestamptz '2026-04-22 20:35+10', timestamptz '2026-04-23 09:14+10'),
  ('b0770000-0000-4000-b000-000000000009', 'b0770000-0000-4000-b000-00000000000a', 'accepted', timestamptz '2026-05-30 18:45+10', timestamptz '2026-05-30 20:02+10');

commit;
