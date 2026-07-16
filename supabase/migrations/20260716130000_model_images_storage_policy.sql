-- 20260716130000_model_images_storage_policy.sql
--
-- BattleBox can now upload and delete model/collection photos from the client.
-- The `model-images` bucket already exists (objects were copied in during the
-- collection data migration) and is read publicly, but it had no client-facing
-- write policy — uploads/deletes were never exercised until now.
--
-- This ensures the bucket exists, is publicly readable, and lets an owner
-- manage objects only inside their own '{uid}/…' folder. New uploads use that
-- convention; legacy objects under other prefixes (e.g. 'boxes/…') stay
-- read-only, which is fine — they are never deleted from the client.
--
-- Idempotent: safe to run whether or not the bucket/policies already exist.

-- ── Bucket ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'model-images', 'model-images', true,
  52428800, -- 50 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/jfif', 'application/octet-stream']
)
on conflict (id) do nothing;

-- ── Policies ─────────────────────────────────────────────────────────────────
-- Public read (bucket is public; belt-and-braces for the API).
drop policy if exists "Anyone can read model images" on storage.objects;
create policy "Anyone can read model images"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'model-images');

-- Owners manage only their own '{uid}/…' folder (upload / delete / update).
drop policy if exists "Users manage own model images" on storage.objects;
create policy "Users manage own model images"
  on storage.objects for all
  to authenticated
  using      (bucket_id = 'model-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'model-images' and (storage.foldername(name))[1] = auth.uid()::text);
