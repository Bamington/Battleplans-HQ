-- 20260804000000_dedupe_notion_import_battles.sql
--
-- The Notion backfill (three batches stamped 2026-07-13 03:01:26, battle ids
-- 73–349) re-created six battles that had already been logged live in the old
-- app. Each pair shares date + game + result and differs only in how the
-- opponent's name was written down.
--
-- The old-app row is kept in every case: it carries the photo, the notes, and
-- the campaign/location links. The imported row carries none of those, so it is
-- deleted outright.
--
--   date         game          keep (old app)        delete (import)
--   2025-07-06   Shatterpoint  20  Michael Mckie     334  Mike Mckie
--   2025-07-19   Blood Bowl    17  Shaun Bentley     337  Shaun ?
--   2025-07-30   Blood Bowl    14  Sam               340  Samuel ?
--   2025-08-06   Blood Bowl    13  Fabian Castillo   341  Fabian Castello
--   2025-08-31   Shatterpoint  6   Danny Crisp       344  Daniel Crisp
--   2025-08-31   Shatterpoint  8   Wade              347  Wade McDonald
--
-- The same name drift split several opponents into two records apiece, which
-- halved the head-to-head counts on the stats page. Those are merged here too.
-- Chris picked the surviving spellings: "Danny Crisp", "Fabian Castillo",
-- "Mike Mckie". None of the absorbed records had an email or a linked_user_id,
-- so nothing is lost in the merge.
--
-- Ordering note: opponents carries a unique index on
-- (user_id, lower(btrim(name))), so a survivor cannot be renamed onto a
-- spelling until the record already holding that spelling is gone. Hence
-- repoint → delete → rename, in that order.

-- ── 1. Drop the duplicated battles ───────────────────────────────────────────
-- battle_opponents rows cascade; none of these six had photos or notes.
delete from public.battles
 where id in (334, 337, 340, 341, 344, 347);

-- ── 2. Repoint the absorbed records' battles onto the survivors ──────────────
-- battle_opponents is keyed (battle_id, opponent_id), so a battle already
-- linked to the survivor would collide. Guard the update and let the opponent
-- delete below cascade away any link left behind.
--
-- The higher-usage record survives each merge: 'Fabian Castello' held 4 battles
-- to 'Fabian Castillo''s 2, and 'Wade' held 2 to 'Wade McDonald''s 0 (its only
-- battle was 347, deleted above). Both get the preferred spelling in step 4.
update public.battle_opponents bo
   set opponent_id = '7ac6404f-cacc-4e33-86c5-2c412b2781e7'   -- Mike Mckie
 where bo.opponent_id = 'f97066ee-980d-41d8-8f95-29382c80bb88' -- Michael Mckie
   and not exists (
     select 1 from public.battle_opponents x
      where x.battle_id = bo.battle_id
        and x.opponent_id = '7ac6404f-cacc-4e33-86c5-2c412b2781e7'
   );

update public.battle_opponents bo
   set opponent_id = '85c3f92f-7aba-4a34-9194-798f9ae4c4de'   -- kept (was 'Fabian Castello')
 where bo.opponent_id = 'bf5215fd-fc59-4d21-8f3f-1f934515dcff' -- absorbed 'Fabian Castillo'
   and not exists (
     select 1 from public.battle_opponents x
      where x.battle_id = bo.battle_id
        and x.opponent_id = '85c3f92f-7aba-4a34-9194-798f9ae4c4de'
   );

update public.battle_opponents bo
   set opponent_id = 'fa9ec69f-973c-4d0b-b349-5561a73a065c'   -- Shaun Bentley
 where bo.opponent_id in (
         '060fc176-61e4-42cd-ad8c-8fc016fbd14e',              -- Shaun ?
         '83c287be-9a45-41d0-878c-08aaf896cd84'               -- Shaun
       )
   and not exists (
     select 1 from public.battle_opponents x
      where x.battle_id = bo.battle_id
        and x.opponent_id = 'fa9ec69f-973c-4d0b-b349-5561a73a065c'
   );

-- ── 3. Delete the absorbed opponent records ──────────────────────────────────
-- 'Daniel Crisp' and 'Samuel ?' are already unreferenced: their only battles
-- (344 and 340) went in step 1. Merged into 'Danny Crisp' and 'Sam' by intent.
delete from public.opponents
 where id in (
   'f97066ee-980d-41d8-8f95-29382c80bb88',  -- Michael Mckie   → Mike Mckie
   'bf5215fd-fc59-4d21-8f3f-1f934515dcff',  -- Fabian Castillo → kept record
   '060fc176-61e4-42cd-ad8c-8fc016fbd14e',  -- Shaun ?         → Shaun Bentley
   '83c287be-9a45-41d0-878c-08aaf896cd84',  -- Shaun           → Shaun Bentley
   'aa5b29a2-4f1b-4045-91b5-b98bfa4aa9ed',  -- Wade McDonald   → renamed 'Wade'
   'a9f7fc87-e52a-4848-8338-ed83150ad3e6',  -- Daniel Crisp    → Danny Crisp
   'a3fece38-98a8-4d15-a327-581474dc5f99'   -- Samuel ?        → Sam
 );

-- ── 4. Adopt the preferred spelling on the surviving records ─────────────────
-- Safe now that the records holding these spellings are gone (see the ordering
-- note above).
update public.opponents
   set name = 'Fabian Castillo'
 where id = '85c3f92f-7aba-4a34-9194-798f9ae4c4de';

update public.opponents
   set name = 'Wade McDonald'
 where id = '4e49c0e2-4b19-4c52-9a43-3a399b895b59';

-- ── 5. Refresh the opp_name cache on the affected battles ────────────────────
-- opp_name denormalises the linked opponents' names; rebuild it only for the
-- battles whose links or spellings just changed, so nothing else churns.
update public.battles b
   set opp_name = names.joined
  from (
    select bo.battle_id,
           string_agg(o.name, ', ' order by o.name) as joined
      from public.battle_opponents bo
      join public.opponents o on o.id = bo.opponent_id
     -- Every opponent of an affected battle, not just the merged one: these
     -- battles can have several, and rebuilding from a subset would drop the
     -- others out of the cache.
     where bo.battle_id in (
             select bo2.battle_id
               from public.battle_opponents bo2
              where bo2.opponent_id in (
                      '7ac6404f-cacc-4e33-86c5-2c412b2781e7',  -- Mike Mckie
                      '85c3f92f-7aba-4a34-9194-798f9ae4c4de',  -- Fabian Castillo
                      '4e49c0e2-4b19-4c52-9a43-3a399b895b59',  -- Wade McDonald
                      'e1aa7143-143e-4669-b9ac-275cacb9f6f9',  -- Danny Crisp
                      'fa9ec69f-973c-4d0b-b349-5561a73a065c',  -- Shaun Bentley
                      'e73ed393-0bb0-4e4d-aa9f-9a3c66dced6a'   -- Sam
                    )
           )
     group by bo.battle_id
  ) as names
 where b.id = names.battle_id
   and b.opp_name is distinct from names.joined;
