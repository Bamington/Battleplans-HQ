-- 20260712000000_battles_add_image.sql
--
-- Give a battle an optional photo, shown as the background of its card on the
-- My Battles column (BattlePlan-Battles-V1.1 redesign).
--
-- Like the collection's model images, we store the storage OBJECT PATH
-- ('{user_id}/{file}') rather than a full URL, and resolve the host client-side
-- via supabase.storage.from('battle-images').getPublicUrl(). That keeps the data
-- portable if the project ever moves.
--
-- Display-only for now: nothing writes this column yet. The upload UI and the
-- import of the previous app's screenshots (the `battle-images` bucket in the
-- old project) are a follow-up — see the V1.1 photo plan.

alter table public.battles
  add column if not exists image_path text;
