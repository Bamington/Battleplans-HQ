-- migration_halo_rule_cards.sql
--
-- Migrates Halo Flashpoint rule storage from the legacy rules/deck_rules tables
-- to the cards table with card_type='rule', matching Kill Team's implementation.
--
-- Run once in the Supabase SQL editor.
-- The rules and deck_rules tables are left intact (not dropped) in case rollback
-- is needed; they will simply be ignored by the updated application code.

-- ── 1. Add rule_types to the Halo Flashpoint game row ──────────────────────
-- This enables the "Rule Cards" panel in the PackEditor (gameHasRules check).
UPDATE games
SET rule_types = '[{"value":"rule","label":"Rule Card","plural":"Rule Cards"}]'::jsonb
WHERE slug = 'halo-flashpoint';

-- ── 2. Migrate deck_rules → cards ──────────────────────────────────────────
-- For every Halo deck_rules entry, insert a new card with card_type='rule'.
-- The card stores the rule title as name and description as stats.description.
-- Rules that exist in the rules table but haven't been added to any deck are
-- intentionally omitted — they have no deck context to migrate to.
INSERT INTO cards (deck_id, game_id, name, stats, card_type, is_template, sort_order, created_at)
SELECT
  dr.deck_id,
  d.game_id,
  r.title,
  jsonb_build_object('description', COALESCE(r.description, '')) AS stats,
  'rule'   AS card_type,
  false    AS is_template,
  dr.sort_order,
  COALESCE(dr.created_at, now())
FROM deck_rules dr
JOIN rules r       ON r.id  = dr.rule_id
JOIN decks d       ON d.id  = dr.deck_id
JOIN games g       ON g.id  = d.game_id
WHERE g.slug = 'halo-flashpoint';
