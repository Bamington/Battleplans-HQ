-- migration_games_import.sql
--
-- Imports games from the previous BattlePlan app (games_rows.csv), preserving
-- the old primary keys so migrated child data (packs, bookings, etc.) keeps
-- referencing them. Run once in the Supabase SQL editor for the shared project.
--
-- Summary: 4 existing games re-pointed to old ids,
--          70 new games inserted, 1 duplicate "Dungeons and Dragons" dropped.
-- Column decisions: manufacturer/default_theme dropped; supported -> enabled_battleplan;
--          image/icon columns added but left null; created_by kept (no FK yet).

begin;

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table public.games
  add column if not exists enabled_battleplan boolean not null default false,
  add column if not exists created_by uuid,           -- FK added later with the user migration
  add column if not exists image      text,
  add column if not exists icon       text;

-- ── 2. Re-point every FK on games(id) to cascade on update ───────────────────
-- Lets us change the 4 overlapping games' ids in place; child rows follow.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'public.games'::regclass
      and pg_get_constraintdef(c.oid) not ilike '%on update%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on update cascade', r.tbl, r.conname, r.def);
  end loop;
end $$;

-- ── 3. Re-point + refresh the 4 overlapping games (matched by slug) ──────────
update public.games set
  id = '1a19e961-8273-46aa-9a74-f0ebd90657c5',
  name = 'Blood Bowl',
  enabled_battleplan = true,
  created_by = null,
  created_at = '2025-08-15 23:41:32.158026+00'
where slug = 'blood-bowl';
update public.games set
  id = '24bc318b-1970-4401-a32d-82737a57dc01',
  name = 'Warhammer 40,000: Kill Team',
  enabled_battleplan = true,
  created_by = null,
  created_at = '2025-08-19 03:34:32.95341+00'
where slug = 'kill-team';
update public.games set
  id = '729b913a-3881-4b2c-a037-001316e12a1c',
  name = 'Starcraft: The Miniatures Game',
  enabled_battleplan = false,
  created_by = 'c0fab326-f180-4fe6-bf1b-87c069be3794',
  created_at = '2026-03-28 21:21:57.565135+00'
where slug = 'starcraft';
update public.games set
  id = '9ec0a79d-f780-4031-86bb-030fa669355e',
  name = 'Halo: Flashpoint',
  enabled_battleplan = true,
  created_by = null,
  created_at = '2025-08-19 03:34:30.170365+00'
where slug = 'halo-flashpoint';

-- ── 4. Insert the 70 new games (old ids preserved) ─────────────────────────
insert into public.games (id, name, slug, enabled_battleplan, created_by, created_at) values
  ('01b7bffd-75cf-4014-9852-830f3f7722f9', 'Rumbleslam', 'rumbleslam', true, null, '2026-01-21 01:42:55.922887+00'),
  ('03666611-8f7e-4170-8408-2d03027a973f', 'Warcrow Adventures', 'warcrow-adventures', true, null, '2025-08-19 03:34:32.456142+00'),
  ('04850f86-14de-4755-8779-999592cf192b', 'Gundam Assemble', 'gundam-assemble', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-17 12:53:18.63932+00'),
  ('05009dfc-a129-4d86-9b25-680feb690746', 'Warhammer 40,000', 'warhammer-40-000', true, null, '2025-08-15 23:41:32.158026+00'),
  ('0681607e-1d06-4232-a3cc-57e6724e7c96', 'Arsenal', 'arsenal', true, null, '2025-08-19 03:34:27.718653+00'),
  ('07a6af65-00cc-469e-ade4-3a9ab973e1ef', 'Bolt Action', 'bolt-action', true, null, '2025-08-19 03:34:28.228811+00'),
  ('118f64ca-fe9b-4bfe-a8a4-57c13f4d33dd', 'Warcrow', 'warcrow', true, null, '2025-08-19 03:34:32.872814+00'),
  ('18b781ec-71b5-481c-8166-1c177817e6b2', 'This Quar''s War', 'this-quars-war', true, null, '2025-08-19 03:34:31.399124+00'),
  ('19376ef7-6337-42ef-ab7d-26ba2cfa7d51', 'Warhammer Underworlds', 'warhammer-underworlds', true, null, '2025-08-19 03:34:33.506654+00'),
  ('1c61d554-a58c-4d6c-9066-d9f5befc8023', 'Warcry', 'warcry', true, null, '2025-08-19 03:34:33.556596+00'),
  ('2258f2fb-3089-4051-b1eb-c317ec4a3450', 'Warmachine', 'warmachine', true, null, '2025-08-15 23:41:32.158026+00'),
  ('28763e5c-fedb-4f9d-813d-d40a595fe984', 'Relics', 'relics', true, null, '2026-01-21 01:43:12.583859+00'),
  ('2a892af5-2139-4651-8047-49dcdc291790', 'Blackstone Fortress', 'blackstone-fortress', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 23:28:50.218743+00'),
  ('2baf65bd-8d3a-4730-a08a-1374a2cec71b', 'Titanicus', 'titanicus', true, null, '2025-08-19 03:34:32.095256+00'),
  ('2c423202-05c0-4805-802d-a0a750340992', 'Star Wars Legion', 'star-wars-legion', true, null, '2025-08-19 03:34:32.16616+00'),
  ('2f8ee64c-9ea1-4340-8d45-de513097932e', 'Age of Fantasy Skirmish', 'age-of-fantasy-skirmish', true, null, '2025-08-19 03:34:27.346468+00'),
  ('332b6e64-e23f-4a4d-96e6-219e4c2cb785', 'Inquisitor', 'inquisitor', false, null, '2025-09-13 12:26:24.521419+00'),
  ('3a1cc6ec-a1ec-4139-abb1-b0c6f29bb04d', 'Age of Sigmar', 'age-of-sigmar', true, null, '2025-08-19 03:34:27.562898+00'),
  ('3e7a0432-6165-4aa6-8ec2-0279fb19cc26', 'Mordheim', 'mordheim', false, null, '2025-09-13 12:25:59.105909+00'),
  ('3ee1de26-9f28-49b0-a939-4d800168731f', 'Battlezone Commander', 'battlezone-commander', true, null, '2026-01-21 01:41:31.535916+00'),
  ('40d47ab1-5680-4dc7-8da4-125a16cd49b4', 'Horus Heresy', 'horus-heresy', true, null, '2025-08-19 03:34:30.3573+00'),
  ('4243ad02-f931-43f4-ae7d-bd8ada3ae4b0', 'Horizon: Zero Dawn', 'horizon-zero-dawn', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 23:16:12.364913+00'),
  ('44e458ea-51b2-4e56-9148-10ed10355eda', 'Star Wars Shatterpoint', 'star-wars-shatterpoint', true, null, '2025-08-19 03:34:31.747061+00'),
  ('4a7bbf70-3b1f-41f3-afd3-596d7712c2d0', 'Middle Earth Strategy Battle Game', 'middle-earth-strategy-battle-game', true, null, '2025-08-19 03:34:31.101868+00'),
  ('509c7772-b964-410d-91d4-70a23959156b', 'Flames of War', 'flames-of-war', true, null, '2025-08-19 03:34:28.854668+00'),
  ('524cbb34-571b-4d1f-b0f9-30036d431eed', 'Aeronautica', 'aeronautica', true, null, '2025-08-19 03:34:26.759656+00'),
  ('52fbb069-ea7c-4638-b259-0c38aa571600', 'Dropfleet Commander', 'dropfleet-commander', true, null, '2026-01-21 01:39:30.86848+00'),
  ('56ad8c6b-a642-4095-b08d-308840cb7673', 'Super Fantasy Brawl', 'super-fantasy-brawl', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('57cc576b-4e38-45f3-93d7-201b69265722', 'Stormlight Miniatures', 'stormlight-miniatures', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('5d31f212-93f3-456f-b279-c2a8ea8cd76a', 'Grimdark Future Warfleets', 'grimdark-future-warfleets', true, null, '2025-08-19 03:34:29.578616+00'),
  ('5e45c53a-3a35-4751-9acc-9956a745b845', 'Dropzone Commander', 'dropzone-commander', true, null, '2026-01-21 01:40:36.882943+00'),
  ('608360b6-9437-4340-b638-b56feb417a6a', 'Dungeons and Dragons', 'dungeons-and-dragons', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-10 00:28:09.594625+00'),
  ('67280e3d-ec58-4177-a2a6-7214c796beed', 'Frostgrave', 'frostgrave', true, null, '2025-09-10 01:16:09.050421+00'),
  ('6a4e9b3e-88d6-42e4-8f3e-2c8830193f09', 'Hero Forge', 'hero-forge', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-18 01:02:56.976494+00'),
  ('6f0d27bf-2be9-437f-a44f-9563292170e5', 'Imperial Assault', 'imperial-assault', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 23:34:29.633406+00'),
  ('6f4ae0b7-a457-4c17-affd-92b3e22c95f0', 'Marvel United', 'marvel-united', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('7037545f-5772-46d3-8f73-be1bf938ac84', 'Star Wars X-Wing', 'star-wars-x-wing', true, null, '2025-08-19 03:34:31.920265+00'),
  ('74d959c4-d1ac-44ff-994f-edc05f652619', 'Test Game', 'test-game', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('8bdd2d21-1b81-4196-a1ca-f6ad93a9694a', 'Infinity', 'infinity', true, null, '2025-08-15 23:41:32.158026+00'),
  ('8dd0f0ab-62cb-4b21-8af0-38bbe371fbfb', 'Unsettled', 'unsettled', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('8eb7a6d8-7c41-41d8-8765-37488b941b12', 'Bot War', 'bot-war', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 23:17:47.326767+00'),
  ('93281a52-0dca-4016-87b0-58807220c171', 'Conquest First Blood', 'conquest-first-blood', true, null, '2025-08-19 03:34:28.385564+00'),
  ('9b284550-7b18-4752-b4ee-ad92cd0fb8e9', 'Carnevale', 'carnevale', true, null, '2026-01-21 01:42:30.761462+00'),
  ('9e0ed3e3-d68d-404f-b8af-0ad0e5311020', 'Bushido', 'bushido', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('9e9ce6a7-5ac5-4cd1-88f8-982f6aa485ef', 'Gloomhaven', 'gloomhaven', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('a01e71b7-ce00-498c-bda2-7dce8b03d580', 'Marvel Crisis Protocol', 'marvel-crisis-protocol', true, null, '2025-08-19 03:34:30.901312+00'),
  ('a30271f8-7d68-400c-a2d3-eee49d40e527', 'Conquest', 'conquest', true, null, '2025-08-19 03:34:28.542502+00'),
  ('a4226750-54a5-4536-a826-97a1c96e296c', 'Grimdark Future', 'grimdark-future', true, null, '2025-08-19 03:34:29.66132+00'),
  ('aa4c7914-3313-4133-b06a-2059a73a9eb3', 'Age of Fantasy Quest', 'age-of-fantasy-quest', true, null, '2025-08-19 03:34:27.016259+00'),
  ('aa727d43-324f-4f5c-9aa6-ebe5810e0abe', 'Battletech', 'battletech', true, null, '2025-08-19 03:34:27.943347+00'),
  ('abdc7897-0795-4b0a-9dee-a5d9b30500e5', 'Song of Ice and Fire', 'song-of-ice-and-fire', true, null, '2025-08-19 03:34:27.867867+00'),
  ('ad353a11-0d5d-4d29-b735-6c839292f35b', 'Grimdark Future Firefight', 'grimdark-future-firefight', true, null, '2025-08-19 03:34:29.000115+00'),
  ('af758cba-ceab-41c4-a25b-8b06d38c7998', 'Trench Crusade', 'trench-crusade', true, null, '2025-08-19 03:34:32.262912+00'),
  ('ba1c4abf-0431-4195-af13-db3d9f4bd654', 'Drop Bears', 'drop-bears', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('c8bd38d8-bbcf-44a0-8994-398feb11f2cd', 'Necromunda', 'necromunda', true, null, '2025-08-19 03:34:31.248825+00'),
  ('ce0ac98a-dfc3-4999-bf20-146a990b0993', 'Warhammer Fantasy', 'warhammer-fantasy', true, null, '2025-08-19 03:34:33.149337+00'),
  ('d379de89-8c2f-473c-8e57-8719a581d4d6', 'Battlefleet Gothic', 'battlefleet-gothic', false, null, '2025-09-13 12:25:34.581458+00'),
  ('d911df0b-f2bf-4f48-ad94-090dda61783c', 'Age of Fantasy', 'age-of-fantasy', true, null, '2025-08-19 03:34:27.424186+00'),
  ('ddd8d8e7-1749-45c5-91e4-0476a6653b7f', 'Warhammer Old World', 'warhammer-old-world', true, null, '2025-08-19 03:34:33.328783+00'),
  ('dde21a77-1dd3-47af-b3d2-6750744bad1e', 'Stargrave', 'stargrave', true, null, '2025-09-10 01:16:24.299558+00'),
  ('e48ed3ad-d836-4c83-8c62-9788973f7283', 'Age of Fantasy Regiments', 'age-of-fantasy-regiments', true, null, '2025-08-19 03:34:27.195001+00'),
  ('e6504cda-bfac-4acb-804f-8fdc1b7999ef', 'Konflict ''47', 'konflict-47', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-10-18 03:12:41.115233+00'),
  ('ecf50c12-a3d5-4fdc-974e-8d28e5d8d70a', 'Half Tilt', 'half-tilt', true, null, '2026-01-21 01:43:34.864613+00'),
  ('ee21590c-2d55-432b-8dc2-ef9ef53f9b73', 'Custom Game', 'custom-game', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-17 22:41:07.722749+00'),
  ('ee2663c1-177c-4210-b066-82088efd22b3', 'Cursed City', 'cursed-city', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00'),
  ('f176868c-dcec-4e6e-91c7-5e231492d5c8', 'Infinity Code One', 'infinity-code-one', true, null, '2025-08-19 03:34:30.512972+00'),
  ('f4012a3d-d645-4189-96eb-8119aa715b71', 'Striketeam Commander', 'striketeam-commander', true, null, '2026-01-21 01:41:57.943845+00'),
  ('f87b8ffc-3c64-4edb-8966-f05027bbc6df', 'Star Trek Adventures', 'star-trek-adventures', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 23:31:04.501412+00'),
  ('f8906f05-5a28-4af0-8ffa-be293e96cba8', 'Other', 'other', true, null, '2025-09-09 23:20:46.300744+00'),
  ('fe17f43a-a108-4555-bbce-602cddb74ca4', 'Rising Sun', 'rising-sun', false, 'c0fab326-f180-4fe6-bf1b-87c069be3794', '2025-09-09 09:15:30.693767+00')
on conflict (id) do nothing;

commit;
