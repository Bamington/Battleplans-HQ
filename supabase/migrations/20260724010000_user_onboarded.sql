-- 20260724010000_user_onboarded.sql
--
-- Re-onboard everyone once. @username and "Your Name" now drive the social
-- features, and most users have an auto-assigned username they've never seen and
-- (52 of 68) no name at all. `onboarded` starts false for every row — existing
-- and new — so the welcome modal fires on next login until they've reviewed and
-- saved their username + name.
--
-- Additive and safe on the shared DB: the deployed app doesn't read or write
-- this column, so nothing changes until the code that gates on it ships. Once it
-- does, everyone (onboarded = false) is prompted exactly once.
--
-- Idempotent.

alter table public.user_profiles
  add column if not exists onboarded boolean not null default false;

comment on column public.user_profiles.onboarded is
  'True once the user has completed/confirmed the welcome modal (username + name). Starts false so the social-era re-onboarding prompt fires once.';

-- Same column-grant trap as the others: user_profiles had blanket UPDATE
-- revoked and re-granted per column, so this new one needs its own grant.
grant update (onboarded) on public.user_profiles to authenticated;
