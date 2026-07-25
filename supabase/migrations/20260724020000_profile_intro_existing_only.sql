-- 20260724020000_profile_intro_existing_only.sql
--
-- The welcome modal's first stage — the "Profiles have changed!" explainer — is
-- only meaningful to users who predate the social features. A brand-new signup
-- has nothing that changed, so they should skip straight to the form.
--
-- `show_profile_intro` marks who sees the intro. Every row that exists when this
-- runs is a pre-social-features user, so they're backfilled to true; the default
-- flips to false afterwards, so everyone who signs up later skips it. This is
-- correct no matter when the branch actually ships — "existing" is defined by the
-- moment the migration runs in prod, not a hardcoded launch date.
--
-- Read-only from the client (it only decides which stage to show), so no update
-- grant is needed — table-level SELECT already covers new columns.
--
-- Written to be re-run-safe: the backfill only ever touches freshly-added NULL
-- rows, never a later signup's false.

alter table public.user_profiles
  add column if not exists show_profile_intro boolean;

-- Existing rows land here as NULL → true. On any re-run there are no NULLs left
-- and new users hold an explicit false, so neither is disturbed.
update public.user_profiles
  set show_profile_intro = true
  where show_profile_intro is null;

alter table public.user_profiles
  alter column show_profile_intro set default false;

alter table public.user_profiles
  alter column show_profile_intro set not null;

comment on column public.user_profiles.show_profile_intro is
  'True for users who predate the social features — they see the welcome modal''s "Profiles have changed!" intro stage. New signups default false and go straight to the form.';
