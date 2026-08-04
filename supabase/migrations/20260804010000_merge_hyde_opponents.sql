-- 20260804010000_merge_hyde_opponents.sql
--
-- Tail end of the opponent cleanup started in 20260804000000. That migration
-- merged the records split by the Notion backfill; sweeping the rest of the
-- list turned up one more genuine pair and one piece of junk.
--
--   'Dan Hyde' (2 battles)  →  'Daniel Hyde' (2 battles)   -- Chris's spelling
--   'Test'     (0 battles)  →  deleted
--
-- Everything else that looked like a duplicate is real: Trav06, AJayD,
-- GrandMasterKoda and friends are online handles, and the five Michaels and
-- two Butlers are different people.
--
-- No rename is needed here — the survivor already carries the wanted spelling —
-- so this one sidesteps the unique index on (user_id, lower(btrim(name))) that
-- forced the repoint → delete → rename ordering in the previous migration.

-- ── 1. Repoint Dan Hyde's battles onto Daniel Hyde ───────────────────────────
-- Guarded against a battle already linked to both, which would collide with
-- battle_opponents' (battle_id, opponent_id) primary key.
update public.battle_opponents bo
   set opponent_id = '725df537-5d03-4e40-a4c5-404b5a645dbe'   -- Daniel Hyde
 where bo.opponent_id = '9689e7a6-24f3-41c6-8b6e-02a4b8d1db00' -- Dan Hyde
   and not exists (
     select 1 from public.battle_opponents x
      where x.battle_id = bo.battle_id
        and x.opponent_id = '725df537-5d03-4e40-a4c5-404b5a645dbe'
   );

-- ── 2. Drop the absorbed record and the test leftover ────────────────────────
-- Any link left behind by the guard above cascades away with the record.
delete from public.opponents
 where id in (
   '9689e7a6-24f3-41c6-8b6e-02a4b8d1db00',  -- Dan Hyde → Daniel Hyde
   'e5b84f98-2625-4725-84b7-4df43284b833'   -- Test, never used by a battle
 );

-- ── 3. Refresh the opp_name cache on Daniel Hyde's battles ───────────────────
-- Rebuilt from every opponent of each affected battle, not just Daniel, so
-- multi-opponent games keep their full list.
update public.battles b
   set opp_name = names.joined
  from (
    select bo.battle_id,
           string_agg(o.name, ', ' order by o.name) as joined
      from public.battle_opponents bo
      join public.opponents o on o.id = bo.opponent_id
     where bo.battle_id in (
             select bo2.battle_id
               from public.battle_opponents bo2
              where bo2.opponent_id = '725df537-5d03-4e40-a4c5-404b5a645dbe'
           )
     group by bo.battle_id
  ) as names
 where b.id = names.battle_id
   and b.opp_name is distinct from names.joined;
