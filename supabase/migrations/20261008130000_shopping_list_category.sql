-- ============================================================
-- shopping_list_items.category (BattleBench)
--
-- What kind of thing an item is: a box/model, a paint, or anything else.
-- Asked for when an item is added. For now it's only a label; later work will
-- hang behaviour off it.
--
-- Backward compatible: NOT NULL with a default, so existing rows become
-- 'other' and the deployed build (which doesn't send it) keeps inserting fine.
-- ============================================================

ALTER TABLE public.shopping_list_items
    ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CONSTRAINT shopping_list_items_category_check CHECK (category IN ('model', 'paint', 'other'));
