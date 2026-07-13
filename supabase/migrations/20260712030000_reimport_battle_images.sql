-- 20260712030000_reimport_battle_images.sql
--
-- Re-import battle photos from the OLD app's battle_images junction table
-- (authoritative: exact battle_id FK, is_primary, display_order). Supersedes the
-- earlier timestamp-correlation import (20260712020000), which only saw the
-- battle-images bucket and guessed battle_ids. The old junction table references
-- images in TWO old buckets (battle-images: 16, model-images: 21); all 37
-- referenced objects were copied into the new battle-images bucket at
-- {user_id}/{filename}. One image per battle; every battle_id + owner verified
-- against public.battles.

-- display_order lets a battle keep multiple ordered photos (all current battles
-- have exactly one). Added here rather than in the create migration since the
-- first import didn't need it.
alter table public.battle_images
  add column if not exists display_order integer not null default 0;

-- Clear the timestamp-guessed rows and replace with the authoritative set.
delete from public.battle_images;

insert into public.battle_images (battle_id, user_id, image_path, is_primary, display_order) values
  (5, '6664e7c4-48ec-4ea5-b342-646f3868f159', '6664e7c4-48ec-4ea5-b342-646f3868f159/1756505334196.jpg', true, 0),
  (6, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756603343374.jpg', true, 0),
  (7, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756619275850.jpg', true, 0),
  (8, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756619343426.jpg', true, 0),
  (12, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756871919930.png', true, 0),
  (13, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756898738256.png', true, 0),
  (14, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872409660.png', true, 0),
  (15, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872634021.png', true, 0),
  (16, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756872760615.png', true, 0),
  (17, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756873318825.png', true, 0),
  (32, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1756898773056.jpg', true, 0),
  (33, '5bc92149-1a32-4807-b507-84ed0953c13a', '5bc92149-1a32-4807-b507-84ed0953c13a/1757507245388.jpg', true, 0),
  (34, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757492324420.jpg', true, 0),
  (36, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757812920710.jpg', true, 0),
  (37, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757824925339.jpg', true, 0),
  (40, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1757889227871.jpg', true, 0),
  (42, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1759617917694-5srrr27vepf.jpg', true, 0),
  (43, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1759617967274-i299c9c7fts.jpg', true, 0),
  (44, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1759621284860-tlzbjmlpd9.jpg', true, 0),
  (45, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1760757777375-sqm8nk5dojb.jpg', true, 0),
  (46, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1763254582231-rzr8a699n6.jpg', true, 0),
  (47, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1763254595676-rp0knp19ipr.jpg', true, 0),
  (48, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1765331506724-txcqgy73rq.jpg', true, 0),
  (49, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1765331492579-ykfx8wo029j.jpg', true, 0),
  (51, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1766290230337-i7z2018f4g.jpg', true, 0),
  (53, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1771141719045-v4jijuusz7.jpg', true, 0),
  (54, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1771141764641-qtu75chzu.jpg', true, 0),
  (55, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1771141863317-kz4wypk3ht.jpg', true, 0),
  (56, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1772246089652-crec0zp3xv5.jpg', true, 0),
  (57, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1772328616177-fsbw9rfsr79.jpg', true, 0),
  (58, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1772328645745-xstavj5g8a.jpg', true, 0),
  (59, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1773544759835-lniqja2ccaq.jpg', true, 0),
  (60, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1773642165455-fgwdgry33vg.jpg', true, 0),
  (61, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1773642202470-mymgsf5wpd.jpg', true, 0),
  (62, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1774733332207-h85nek1ukyd.jpg', true, 0),
  (63, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1774733345444-w704hxj2vlg.jpg', true, 0),
  (64, 'c0fab326-f180-4fe6-bf1b-87c069be3794', 'c0fab326-f180-4fe6-bf1b-87c069be3794/1774733358392-xcwz2pd6dx9.jpg', true, 0);
