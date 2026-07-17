-- 20260716150000_seed_paint_packs.sql
--
-- Seed the official paint-pack catalogue from the shared library's taxonomy:
-- one official pack per (brand, sub_brand) range present in the public
-- hobby_items (e.g. "Citadel Contrast", "Army Painter Warpaints", "Two Thin
-- Coats Wave 1"). Packs reference the shared paints — no rows are duplicated.
--
-- Idempotent: a partial unique index on (brand, sub_brand) for official packs
-- plus ON CONFLICT guards make a re-run a no-op.

-- Record the range on the pack so items can be matched exactly (and for future
-- display). Distinct from the free-text `brand` already present.
ALTER TABLE public.paint_packs ADD COLUMN IF NOT EXISTS sub_brand text;

CREATE UNIQUE INDEX IF NOT EXISTS paint_packs_official_range_idx
    ON public.paint_packs (brand, sub_brand) WHERE is_official;

-- Create the packs and fill each with its paints in one data-modifying CTE.
WITH ranges AS (
    SELECT trim(brand) AS brand, trim(sub_brand) AS sub_brand
    FROM public.hobby_items
    WHERE public
      AND coalesce(trim(brand), '')     <> ''
      AND coalesce(trim(sub_brand), '') <> ''
    GROUP BY trim(brand), trim(sub_brand)
),
new_packs AS (
    INSERT INTO public.paint_packs (name, brand, sub_brand, description, is_public, is_official)
    SELECT
        brand || ' ' || sub_brand,
        brand,
        sub_brand,
        'The ' || brand || ' ' || sub_brand || ' paint range.',
        true, true
    FROM ranges
    ON CONFLICT (brand, sub_brand) WHERE is_official DO NOTHING
    RETURNING id, brand, sub_brand
)
INSERT INTO public.paint_pack_items (pack_id, hobby_item_id, display_order)
SELECT
    np.id,
    hi.id,
    (row_number() OVER (PARTITION BY np.id ORDER BY hi.name))::int - 1
FROM new_packs np
JOIN public.hobby_items hi
  ON hi.public
 AND trim(hi.brand)     = np.brand
 AND trim(hi.sub_brand) = np.sub_brand
ON CONFLICT (pack_id, hobby_item_id) DO NOTHING;
