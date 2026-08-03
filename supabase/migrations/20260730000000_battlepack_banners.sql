-- 20260730000000_battlepack_banners.sql
--
-- A custom banner image for a pack.
--
-- Until now the hero showed the GAME's artwork, which is the same picture for
-- every Warhammer 40,000 event ever run. An organiser who has made a poster for
-- their event wants that poster, so this adds an optional per-pack image that
-- takes the hero when present and falls back to the game art when it does not.
--
-- Two parts:
--   1. `battlepacks.banner_path` — the storage object key, not a full URL,
--      matching the convention used by avatars / model_images / battle_images
--      so a project move needs no data migration.
--   2. A `pack-banners` bucket whose write policy is the pack's own edit rule
--      rather than the usual owner-folder check. Packs belong to a store, not a
--      person: every admin of the venue can edit the pack, so every admin of the
--      venue has to be able to replace its banner.
--
-- Backward-compatible on the shared database. The column is nullable and
-- nothing reads it yet, so production carries on exactly as before until the
-- BattlePack deploy lands.
--
-- Idempotent: safe to re-run.

-- ── 1. Column ────────────────────────────────────────────────────────────────
alter table public.battlepacks
  add column if not exists banner_path text;

comment on column public.battlepacks.banner_path is
  'Object key inside the `pack-banners` storage bucket, e.g. ''{pack_id}/1737…-ab12.jpg''. Resolve with getPublicUrl() at read time. Null means fall back to the game''s artwork.';

-- ── 2. Storage bucket ────────────────────────────────────────────────────────
-- 5 MB is a backstop against a rogue client, not a UX boundary: the client
-- crops and downscales to a 1800×600 JPEG (~200 KB) before uploading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pack-banners', 'pack-banners', true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public read. A published pack's page is world-readable at its slug, so its
-- banner has to be too — and anon needs it before there is any session.
drop policy if exists "Anyone can read pack banners" on storage.objects;
create policy "Anyone can read pack banners"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'pack-banners');

-- Write access is the pack's edit rule, keyed on the first path segment.
--
-- The usual '{uid}/…' owner-folder pattern would be wrong here: it would let
-- the person who created the pack replace the banner and lock out every other
-- admin of the same store, which is the opposite of how packs are owned.
--
-- The folder name is cast to uuid, so it MUST be guarded — a path like
-- 'foo/bar.jpg' would otherwise raise 22P02 instead of simply failing the
-- check. The regex runs first and short-circuits.
drop policy if exists "Pack editors manage pack banners" on storage.objects;
create policy "Pack editors manage pack banners"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'pack-banners'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_edit_battlepack(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'pack-banners'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_edit_battlepack(((storage.foldername(name))[1])::uuid)
  );
