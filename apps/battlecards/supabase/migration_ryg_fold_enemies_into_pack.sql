-- ============================================================
-- BattleCards — fold the enemies into the main RYG pack
--
-- The enemies arrived as their own "Enemies" pack, which left two
-- official RYG packs and a duplicate of nearly every weapon and
-- piece of equipment: 14 of the 15 already existed in "Repent Ye
-- Foolish Gods!" under the same name and type. A player importing
-- both would have ended up with two Daggers.
--
-- This moves the enemies into the book pack and drops the
-- duplicates, keeping the BOOK's copy in every case. That version
-- is the better record: its weapons carry real addon_keywords rows
-- rather than a keyword string in the description, its Shield has
-- rules text (including how an AI-run enemy uses one), and its
-- armour wording is more careful — "-1 inch to Movement" against
-- the terser "-1 Movement".
--
-- WHERE THE TWO DISAGREED ON DAMAGE, THE ENEMY VALUE WINS
--   Flamberge  1D6+4 → 2D6+4
--   Falchion   1D6+4 → 2D6+5
-- Both come from the enemy entries in the book (Reaver and
-- Apostate), confirmed as correct. This does change those weapons
-- for warriors too — one Flamberge now exists, not two.
--
-- STILL UNRESOLVED: the Dagger's range. The enemy entries give
-- "R: 8"" and the book pack's Dagger has no range at all. That is
-- left alone here rather than decided quietly, because unlike the
-- damage above it was never put in front of anyone. Enemy daggers
-- will read as melee until someone rules on it.
--
-- Re-running is safe: it exits when the Enemies pack is gone.
--
-- Run after migration_ryg_enemy_pack.sql.
-- ============================================================

do $$
declare
  v_game    uuid;
  v_book    uuid;
  v_enemies uuid;
  v_moved   int;
  v_dropped int;
begin
  select id into v_game from public.games where slug = 'ryg';

  select id into v_book
    from public.packs
   where game_id = v_game and name = 'Repent Ye Foolish Gods!';

  select id into v_enemies
    from public.packs
   where game_id = v_game and name = 'Enemies';

  if v_enemies is null then
    raise notice 'No Enemies pack — already folded.';
    return;
  end if;
  if v_book is null then
    raise exception 'No "Repent Ye Foolish Gods!" pack to fold into';
  end if;

  -- ── 1. Corrected damage on the two that disagreed ─────────

  update public.addons
     set stats = stats || jsonb_build_object('damage', '2D6+4')
   where pack_id = v_book and name = 'Flamberge';

  update public.addons
     set stats = stats || jsonb_build_object('damage', '2D6+5')
   where pack_id = v_book and name = 'Falchion';

  -- ── 2. Point the enemies at the book's addons ─────────────
  -- Matched on type and name, which is unique within the pack.

  update public.card_addons ca
     set addon_id = book.id
    from public.addons dup
    join public.addons book
      on book.pack_id       = v_book
     and book.addon_type_id = dup.addon_type_id
     and book.name          = dup.name
   where dup.pack_id  = v_enemies
     and ca.addon_id  = dup.id;

  -- ── 3. Drop the duplicates ────────────────────────────────
  -- Nothing references them now.

  delete from public.addons a
   where a.pack_id = v_enemies
     and exists (
       select 1 from public.addons b
        where b.pack_id       = v_book
          and b.addon_type_id = a.addon_type_id
          and b.name          = a.name
     );
  get diagnostics v_dropped = row_count;

  -- ── 4. Move what was genuinely new ────────────────────────
  -- The 19 enemy abilities, and any weapon the book didn't have.

  update public.addons set pack_id = v_book where pack_id = v_enemies;
  get diagnostics v_moved = row_count;

  -- ── 5. Move the enemies themselves ────────────────────────

  update public.cards set pack_id = v_book where pack_id = v_enemies;

  -- ── 6. Retire the now-empty pack ──────────────────────────

  delete from public.packs where id = v_enemies;

  raise notice 'Folded enemies in: % duplicate addons dropped, % moved.', v_dropped, v_moved;
end $$;
