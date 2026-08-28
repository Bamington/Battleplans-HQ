-- ============================================================================
-- Venue regions — country + postcode on locations and on users
-- ============================================================================
--
-- WHY. Every venue on the platform is Australian today, and English shops are
-- being onboarded. Without something to match on, an Australian player is shown
-- an English shop as a bookable option, which is noise at best and a wasted
-- booking at worst.
--
-- WHAT IS STORED HERE, AND WHAT IS NOT. This migration stores only the two raw
-- facts — `country` and `postcode` — on both sides. The REGION derived from
-- them ("AU-VIC", "GB") is deliberately NOT a column: it lives in one place, in
-- packages/ui/src/lib/regions.ts, so a change to how UK postcodes are grouped
-- is a code change and not a data migration. A stored generated column would
-- have silently gone stale the first time that mapping was refined.
--
-- HOW THE MATCH BEHAVES. Filtering happens client-side, and only ever when BOTH
-- sides have a known region. A location with no postcode is shown to everyone,
-- which keeps clubs (no address of their own) and the test venues working
-- exactly as they do now. That does mean an English shop added with no postcode
-- would be visible to Australians — the admin form is what closes that, by
-- requiring a postcode wherever it requires an address.
--
-- BACKWARD COMPATIBLE. Both columns are nullable with no default, so the
-- currently deployed apps — which select neither — are unaffected. Safe to
-- apply to the shared database ahead of the app deploy.

-- ── Locations ────────────────────────────────────────────────────────────────

alter table public.locations
  add column if not exists country  text,
  add column if not exists postcode text;

comment on column public.locations.country is
  'ISO 3166-1 alpha-2, uppercase. Null means the region filter never excludes this location.';
comment on column public.locations.postcode is
  'Postcode as the venue writes it, trimmed and uppercased. Paired with country to derive a region.';

-- Uppercase two letters, or nothing. Existing rows are all null until the
-- backfill below, so this can never fail on data already in the table.
alter table public.locations
  drop constraint if exists locations_country_format;
alter table public.locations
  add constraint locations_country_format
  check (country is null or country ~ '^[A-Z]{2}$');

-- ── User profiles ────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists country  text,
  add column if not exists postcode text;

comment on column public.user_profiles.country is
  'ISO 3166-1 alpha-2, uppercase. Asked during onboarding. Private — own-row RLS, and not in public_profiles.';
comment on column public.user_profiles.postcode is
  'The user''s postcode, trimmed and uppercased. Used only to pick which venues to offer.';

alter table public.user_profiles
  drop constraint if exists user_profiles_country_format;
alter table public.user_profiles
  add constraint user_profiles_country_format
  check (country is null or country ~ '^[A-Z]{2}$');

-- user_profiles grants UPDATE per column (see 20260722000000), so a new column
-- is read-only to the app until it is named here. Without this the onboarding
-- save fails with a permission error rather than a validation one.
grant update (country, postcode) on public.user_profiles to authenticated;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Every location that exists today is Australian, so country is unambiguous.

update public.locations
   set country = 'AU'
 where country is null;

-- Postcodes live inside the free-text address, in the four shapes actually
-- present: "... Fitzroy VIC 3065", "... Australia, 3215", "... Landing 3027".
-- The greedy leading `.*` forces the LAST standalone four-digit run, so a
-- street number ("14 Warren Street") can never be mistaken for a postcode.
-- Rows with no four-digit run — the clubs, the spaces and the test fixtures —
-- stay null on purpose and remain visible to everyone.
update public.locations
   set postcode = substring(address from '.*\y([0-9]{4})\y')
 where postcode is null
   and address is not null
   and substring(address from '.*\y([0-9]{4})\y') is not null;

-- One real venue records its suburb but not its postcode.
update public.locations
   set postcode = '3030'
 where postcode is null
   and address ilike '%Werribee%';
