-- ============================================================================
-- Welcome flows — remembering which intros a user has already been shown
-- ============================================================================
--
-- WHY. The welcome modal's intro stage has been a single hardcoded screen
-- ("Profiles have changed!") behind a single boolean, `show_profile_intro`.
-- That works exactly once. The moment a second release wants to say something,
-- there is nowhere to put it: the copy is baked into the component and the flag
-- cannot tell one announcement from another. Sixty-eight users are currently
-- being shown the social-release intro again on the region release, which is
-- precisely that bug.
--
-- WHAT THIS REPLACES IT WITH. A set of flow keys the user has completed.
-- Each release defines a flow with its own key and its own copy in code; this
-- column only records which of them a given user has finished. Adding a second,
-- third or tenth flow needs no migration.
--
-- WHY AN ARRAY AND NOT A TABLE. Flows are a handful of short keys read on every
-- app boot, always all at once, and never queried across users. A joined table
-- would cost a round trip on the hot path to model a relationship nothing asks
-- questions about. `locations.admins` and `updates.apps` already take the same
-- shape for the same reason.
--
-- WHAT IS DELIBERATELY LEFT ALONE. `onboarded` and `show_profile_intro` are
-- still read by the deployed apps, so both stay. The new code stops reading
-- `show_profile_intro` — that is what stops the stale intro — but dropping
-- either column would break production the moment this is applied, and one
-- database sits behind prod and every preview.
--
-- BACKWARD COMPATIBLE. One new column with a default, read by nothing that is
-- currently deployed. Safe to apply ahead of the app deploy.

alter table public.user_profiles
  add column if not exists seen_welcome_flows text[] not null default '{}'::text[];

comment on column public.user_profiles.seen_welcome_flows is
  'Keys of the welcome flows this user has completed. Each release defines its flow and copy in code (packages/ui/src/components/WelcomeModal.tsx); this only records which are done. Supersedes show_profile_intro.';

-- user_profiles grants UPDATE per column (see 20260722000000), so without this
-- the client can read the array but never append to it — the flow would be
-- shown again on every login.
grant update (seen_welcome_flows) on public.user_profiles to authenticated;

-- ── Backfill: the base onboarding flow ───────────────────────────────────────
--
-- Every app now runs a flow, and the simple ones (BattleCards, BattleBench,
-- BattlePack) run the same one: a short welcome, then the username form. That
-- flow is genuinely new to a first-time user and genuinely NOT new to the sixty
-- who have already been through onboarding — greeting a long-standing user with
-- "Welcome to BattleCards" would be a worse bug than the one this migration
-- exists to fix.
--
-- So `onboarded` is translated into its flow-key equivalent. Anyone who has
-- completed onboarding is recorded as having completed the onboarding flow.
--
-- Deliberately NOT backfilled: any per-release announcement key. Those are
-- meant to be new to everyone, which is the whole point of announcing them.
update public.user_profiles
   set seen_welcome_flows = array['profile-onboarding-v1']
 where onboarded
   and seen_welcome_flows = '{}'::text[];
