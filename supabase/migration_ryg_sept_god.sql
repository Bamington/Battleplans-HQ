-- migration_ryg_sept_god.sql
-- Extends card_type check to include 'sept' and 'god', and seeds new addon types.

-- 1. Drop the existing check constraint
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_card_type_check;

-- 2. Re-add with the new values
ALTER TABLE cards ADD CONSTRAINT cards_card_type_check
  CHECK (card_type IN ('operative', 'rule', 'sept', 'god'));

-- 3. Seed new addon types for RYG
-- septs: the sept addon itself (name, 3 requirements)
INSERT INTO addon_types (game_id, name, slug, stat_schema)
SELECT g.id, 'Septs', 'septs', '[]'::jsonb
FROM games g WHERE g.slug = 'ryg'
ON CONFLICT DO NOTHING;

-- destinies: a destiny rule for a sept card
INSERT INTO addon_types (game_id, name, slug, stat_schema)
SELECT g.id, 'Destinies', 'destinies', '[]'::jsonb
FROM games g WHERE g.slug = 'ryg'
ON CONFLICT DO NOTHING;

-- sept-benefits: individual benefit rows shown on the sept card
INSERT INTO addon_types (game_id, name, slug, stat_schema)
SELECT g.id, 'Sept Benefits', 'sept-benefits', '[]'::jsonb
FROM games g WHERE g.slug = 'ryg'
ON CONFLICT DO NOTHING;

-- gods: god cards
INSERT INTO addon_types (game_id, name, slug, stat_schema)
SELECT g.id, 'Gods', 'gods', '[]'::jsonb
FROM games g WHERE g.slug = 'ryg'
ON CONFLICT DO NOTHING;
