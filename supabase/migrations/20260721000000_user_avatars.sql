-- 20260721000000_user_avatars.sql
--
-- Profile pictures for user accounts.
--
-- Three parts:
--   1. `user_profiles.avatar_path` — the storage object key, not a full URL,
--      matching the convention used by model_images / box_images / battle_images
--      so a project move needs no data migration.
--   2. An `avatars` storage bucket with the standard owner-folder write policy.
--   3. A `public_profiles` view — user_profiles RLS is select-own, but the
--      upcoming social features need one user to see another's name and picture.
--      The view exposes ONLY (id, username, avatar_path); role and
--      preferred_location_id stay private.
--
-- Idempotent: safe to re-run.

-- ── 1. Column ────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists avatar_path text;

comment on column public.user_profiles.avatar_path is
  'Object key inside the `avatars` storage bucket, e.g. ''{uid}/1737…-ab12.jpg''. Resolve with getPublicUrl() at read time. Null means fall back to initials.';

-- migration_onboarding.sql revoked blanket UPDATE and re-granted it per column,
-- so a new column is NOT writable by the client until it is granted explicitly.
-- Without this the client update fails with a permission error.
grant update (avatar_path) on public.user_profiles to authenticated;

-- ── 2. Storage bucket ────────────────────────────────────────────────────────
-- 5 MB is ample: the client crops and downscales to a 512px square JPEG before
-- uploading. The limit is a backstop against a rogue client, not a UX boundary.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public read (bucket is public; belt-and-braces for the API).
drop policy if exists "Anyone can read avatars" on storage.objects;
create policy "Anyone can read avatars"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

-- Owners manage only their own '{uid}/…' folder (upload / delete / update).
drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar"
  on storage.objects for all
  to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3. Public profile view ───────────────────────────────────────────────────
-- security_invoker = false (the default) is deliberate: the view runs as its
-- owner and so bypasses the select-own RLS policy on user_profiles. That is the
-- entire point — it is the one sanctioned window onto other users, and it is
-- narrowed to the three columns below. Do NOT add role or any other column here
-- without thinking about who gets to see it.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = false) as
  select id, username, avatar_path
  from public.user_profiles;

alter view public.public_profiles owner to postgres;

comment on view public.public_profiles is
  'Read-only, non-sensitive slice of user_profiles (id, username, avatar_path) that any signed-in user may read. Deliberately bypasses the select-own RLS on the base table.';

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;
