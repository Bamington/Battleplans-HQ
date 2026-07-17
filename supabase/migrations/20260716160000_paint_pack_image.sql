-- 20260716160000_paint_pack_image.sql
--
-- Let paint packs carry a logo/image. Stored as a storage object key in the
-- existing `model-images` bucket (resolved to a URL client-side, like model and
-- box images) rather than a full URL, so a future project move needs no data
-- change.

ALTER TABLE public.paint_packs ADD COLUMN IF NOT EXISTS image_path text;

-- Recreate the summary view so its p.* picks up the new column. (CREATE OR
-- REPLACE can't reorder existing view columns, so drop first.)
DROP VIEW IF EXISTS public.paint_pack_summary;
CREATE VIEW public.paint_pack_summary WITH (security_invoker = true) AS
    SELECT p.*, count(ppi.hobby_item_id) AS item_count
    FROM public.paint_packs p
    LEFT JOIN public.paint_pack_items ppi ON ppi.pack_id = p.id
    GROUP BY p.id;

GRANT SELECT ON public.paint_pack_summary TO authenticated, anon;
