-- 20260712020000_import_battle_images.sql
--
-- Import the previous app's battle photos, copied into the new `battle-images`
-- bucket. The image→battle link is not in the old data (battles.image_url was
-- null); it was recovered by correlating each photo's upload time to the nearest
-- same-user battle's created_at (both preserved through the migration) and
-- reviewed before committing. 17 confident links; 4 orphans (3 early test
-- uploads + 1 image whose user has no migrated battle) were left in the bucket
-- unlinked. The earliest photo per battle is the primary (card background).
--
-- Safe to re-run: keyed on image_path (unique).

insert into public.battle_images (battle_id, user_id, image_path, is_primary)
values
  ('5', '6664e7c4-48ec-4ea5-b342-646f3868f159', '6664e7c4-48ec-4ea5-b342-646f3868f159/1756505334196.jpg', true),
  ('6', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756603343374.jpg', true),
  ('7', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756619275850.jpg', true),
  ('8', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756619343426.jpg', true),
  ('12', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756871919930.png', true),
  ('14', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872337386.jpg', true),
  ('14', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872409660.png', false),
  ('15', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872634021.png', true),
  ('16', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872760615.png', true),
  ('17', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756873318825.png', true),
  ('32', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756898738256.png', true),
  ('32', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756898773056.jpg', false),
  ('33', '5bc92149-1a32-4807-b507-84ed0953c13a', '5bc92149-1a32-4807-b507-84ed0953c13a/1757507245388.jpg', true),
  ('34', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757492324420.jpg', true),
  ('36', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757812920710.jpg', true),
  ('37', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757824925339.jpg', true),
  ('40', 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757889227871.jpg', true)
on conflict (image_path) do nothing;
