-- 20261116160000_minimyths_archive_venues.sql
--
-- Renamed from 20261116120000: that version collided with
-- 20261116120000_halo_list_rules from a concurrent session, and Supabase keys
-- applied migrations on the 14-digit prefix, so one of the two would have been
-- silently skipped forever. Already applied to production under the old
-- version; re-running is a no-op because every insert is ON CONFLICT DO NOTHING.
--
-- The five venues the Mini Myths event archive needs, and nothing else.
--
-- WHY. Importing the club's 2022-2026 back catalogue into BattlePack needs a
-- `locations` row per venue. Three already exist (Guf Werribee, Top Table
-- Games, The Djerring Center); these five do not, and without them 22 imported
-- packs would publish with no venue at all — an archive entry that cannot say
-- where it happened.
--
-- KIND, DELIBERATELY SPLIT. `venue` is "a bookable business, listed publicly".
-- The three shops are exactly that and are already public businesses running
-- open events. The other two are rooms the club HIRED for one event each —
-- Sandown for Arcfest, Arndell Park for War for Werribee 2025 — so they are
-- `space`, which carries an address but never appears on the public list.
-- Calling a racecourse a bookable wargaming venue would be wrong, and would
-- put it in every venue picker on the platform.
--
-- Both spaces are owned by the Mini Myths club row, which is what `space`
-- requires: a space exists because somebody made it.
--
-- POSTCODES ARE ONLY SET WHERE THE SOURCE HAD ONE. Games Portal's Notion
-- address carries no postcode, so it is left null rather than guessed —
-- region filtering would rather have nothing than a wrong answer.
--
-- Ids are hard-coded so the import map can reference them before this runs.
-- Idempotent; additive only; safe on the shared database ahead of any deploy.

insert into public.locations (id, name, address, country, postcode, kind, is_test)
values
  ('9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b401',
   'Gaming Arena',      '123 Bakers Rd, Coburg North VIC 3058',
   'AU', '3058', 'venue', false),
  ('9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b402',
   'Games Portal',      '1-5 Station Street, Mitcham',
   'AU', null,   'venue', false),
  ('9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b403',
   'Andrew''s Hobbies', 'Unit 26/39 Eucumbene Dr, Ravenhall VIC 3023',
   'AU', '3023', 'venue', false)
on conflict (id) do nothing;

-- The two hired rooms, owned by the club that hired them.
insert into public.locations (id, name, address, country, postcode, kind, is_test, owner_location_id)
values
  ('9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b404',
   'Arcfest (Sandown Racecourse)',   '591-659 Princes Hwy, Springvale VIC 3171',
   'AU', '3171', 'space', false, '53809c67-b6a5-4ebc-8941-9c14da626d5a'),
  ('9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b405',
   'Arndell Park Community Center',  '49/29-49 Federation Blvd, Truganina VIC 3029',
   'AU', '3029', 'space', false, '53809c67-b6a5-4ebc-8941-9c14da626d5a')
on conflict (id) do nothing;
