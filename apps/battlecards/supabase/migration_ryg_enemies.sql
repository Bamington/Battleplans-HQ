-- ============================================================
-- BattleCards — RYG enemy cards
--
-- Enemies are units the warband fights: the same five stats a
-- warrior has, one or more special abilities, weapons and
-- equipment, plus two properties of their own — an Enemy Type
-- and an AI Type.
--
-- They live in the deck alongside warriors, the way sept and god
-- cards already do, and sort to the end of it.
--
-- WHAT THIS ADDS
--   1. 'enemy' as a card_type
--   2. an Enemy Abilities addon type for RYG
--
-- Enemy Type and AI Type are not columns. They live in
-- cards.stats alongside offense/defense/life/tactics/fate, which
-- is where every other game-specific card value lives — see the
-- stats jsonb on public.cards.
--
-- Run in the Supabase SQL editor after migration_ryg.sql.
-- ============================================================


-- ── 1. Allow enemy cards ────────────────────────────────────────────────────
-- The constraint already carries 'sept' and 'god' from the RYG work; this adds
-- the fourth RYG type. Dropping and re-adding is the only way to widen a CHECK.

alter table public.cards
  drop constraint if exists cards_card_type_check;

alter table public.cards
  add constraint cards_card_type_check
    check (card_type in ('operative', 'rule', 'sept', 'god', 'enemy'));


-- ── 2. Enemy abilities ──────────────────────────────────────────────────────
--
-- A separate pool from the player-facing 'special-ability' type: enemy
-- abilities are written for the units the warband fights, and mixing the two
-- pools in one picker would make both harder to search.
--
-- The shape is deliberately minimal — a title and a description. The title
-- lives in addons.name and the text in addons.description, so no stat_schema
-- is needed; an empty schema is what the other text-only types use.
--
-- The card shows the title only when it differs from the enemy's own name,
-- which is what it defaults to, so a one-ability enemy reads as a clean block
-- of rules rather than repeating its own name as a heading.

insert into public.addon_types (game_id, slug, name, stat_schema)
select g.id, 'enemy-abilities', 'Enemy Abilities', '[]'::jsonb
from public.games g
where g.slug = 'ryg'
  and not exists (
    select 1 from public.addon_types t
    where t.game_id = g.id and t.slug = 'enemy-abilities'
  );
